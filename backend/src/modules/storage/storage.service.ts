import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import axios from 'axios';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly defaultNasPath = './storage/nas';

  constructor(private prisma: PrismaService) {}

  // Get current storage configuration
  async getConfig() {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: 'storage_config' },
    });

    if (!setting) {
      return {
        activeDriver: 'DATABASE',
        s3: { endpoint: '', accessKeyId: '', secretAccessKey: '', bucket: '', region: 'us-east-1' },
        googleDrive: { clientId: '', clientSecret: '', refreshToken: '', folderId: '' },
        nas: { path: this.defaultNasPath },
      };
    }

    return setting.value as any;
  }

  // Update active storage configuration
  async saveConfig(config: any) {
    return this.prisma.systemSetting.upsert({
      where: { key: 'storage_config' },
      create: { key: 'storage_config', value: config },
      update: { value: config },
    });
  }

  // Transparently process attachments list:
  // Converts base64 Data URLs into active driver uploads and replaces them with a proxy download URL
  async processAttachments(
    attachments: string[],
    userId: string,
    entityId?: string,
    entityType?: string,
  ): Promise<string[]> {
    if (!attachments || attachments.length === 0) return [];

    const processed: string[] = [];

    for (const attachment of attachments) {
      if (attachment.startsWith('data:')) {
        try {
          const fileRecord = await this.uploadFile(attachment, userId, entityId, entityType);
          // Generate the standard public streaming gateway URL
          const downloadUrl = `/api/storage/download/${fileRecord.id}`;
          processed.push(downloadUrl);
        } catch (error) {
          this.logger.error(`Failed to process base64 attachment: ${error.message}`);
          // Fallback to saving original string if upload fails to prevent data loss
          processed.push(attachment);
        }
      } else {
        // Keep as-is if already uploaded or standard URL
        processed.push(attachment);
      }
    }

    return processed;
  }

  // Parse a base64 Data URL and upload it using the active driver
  async uploadFile(base64DataUrl: string, userId: string, entityId?: string, entityType?: string) {
    const mimeMatch = base64DataUrl.match(/^data:([^;]+)/);
    if (!mimeMatch) {
      throw new BadRequestException('Invalid Base64 Data URL format');
    }

    const mimeType = mimeMatch[1];
    
    // Extract custom original name attribute if present
    const nameMatch = base64DataUrl.match(/;name=([^;,\s]+)/i);
    let filename = nameMatch ? decodeURIComponent(nameMatch[1]) : 'attachment';

    // Sanitize filename to remove dangerous characters
    filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

    // Extract raw base64 data
    const parts = base64DataUrl.split(';base64,');
    if (parts.length !== 2) {
      throw new BadRequestException('Invalid base64 payload segment');
    }

    const base64Data = parts[1];
    const buffer = Buffer.from(base64Data, 'base64');
    const size = buffer.length;
    const fileId = crypto.randomUUID();

    // Fetch active storage driver config
    const config = await this.getConfig();
    const driver = config.activeDriver || 'DATABASE';
    let storagePath = '';

    if (driver === 'DATABASE') {
      // Store raw base64 inside the Database StorageFile table path
      storagePath = base64DataUrl;
    } else if (driver === 'NAS') {
      // Local directory mount configuration
      const nasFolder = config.nas?.path || this.defaultNasPath;
      if (!fs.existsSync(nasFolder)) {
        fs.mkdirSync(nasFolder, { recursive: true });
      }
      const fileExt = path.extname(filename) || `.${mimeType.split('/')[1] || 'bin'}`;
      const physicalName = `${fileId}-${filename}`;
      const fullPath = path.join(nasFolder, physicalName);
      
      fs.writeFileSync(fullPath, buffer);
      storagePath = fullPath;
    } else if (driver === 'S3') {
      // S3 File Upload implementation
      const s3Config = config.s3;
      if (!s3Config?.endpoint || !s3Config?.bucket) {
        // Safe graceful fallback if S3 is unconfigured
        this.logger.warn('S3 is unconfigured! Falling back to local NAS storage.');
        return this.uploadFileWithFallback('NAS', base64DataUrl, userId, entityId, entityType, fileId, filename, mimeType, buffer, size);
      }
      
      // Perform S3 direct REST PUT request upload
      try {
        const key = `uploads/${fileId}-${filename}`;
        const url = `${s3Config.endpoint.replace(/\/$/, '')}/${s3Config.bucket}/${key}`;
        
        await axios.put(url, buffer, {
          headers: {
            'Content-Type': mimeType,
            'x-amz-acl': 'public-read', // standard access control
          },
        });
        
        storagePath = `s3://${s3Config.bucket}/${key}`;
      } catch (err) {
        this.logger.error(`S3 upload error: ${err.message}. Falling back to NAS.`);
        return this.uploadFileWithFallback('NAS', base64DataUrl, userId, entityId, entityType, fileId, filename, mimeType, buffer, size);
      }
    } else if (driver === 'GOOGLE_DRIVE') {
      // Google Drive File Upload implementation
      const driveConfig = config.googleDrive;
      if (!driveConfig?.clientId || !driveConfig?.refreshToken) {
        this.logger.warn('Google Drive is unconfigured! Falling back to local NAS storage.');
        return this.uploadFileWithFallback('NAS', base64DataUrl, userId, entityId, entityType, fileId, filename, mimeType, buffer, size);
      }

      try {
        // 1. Get access token from refresh token
        const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
          client_id: driveConfig.clientId,
          client_secret: driveConfig.clientSecret,
          refresh_token: driveConfig.refreshToken,
          grant_type: 'refresh_token',
        });
        
        const accessToken = tokenRes.data.access_token;

        // 2. Perform multipart upload
        const metadata = {
          name: filename,
          parents: driveConfig.folderId ? [driveConfig.folderId] : undefined,
        };

        const boundary = '-------314159265358979323846';
        const delimiter = `\r\n--${boundary}\r\n`;
        const closeDelimiter = `\r\n--${boundary}--`;

        const multipartBody = Buffer.concat([
          Buffer.from(delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) + delimiter),
          Buffer.from(`Content-Type: ${mimeType}\r\nContent-Transfer-Encoding: base64\r\n\r\n`),
          Buffer.from(base64Data),
          Buffer.from(closeDelimiter),
        ]);

        const uploadRes = await axios.post(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
          multipartBody,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': `multipart/related; boundary=${boundary}`,
            },
          },
        );

        storagePath = `drive://${uploadRes.data.id}`;
      } catch (err) {
        this.logger.error(`Google Drive upload error: ${err.message}. Falling back to NAS.`);
        return this.uploadFileWithFallback('NAS', base64DataUrl, userId, entityId, entityType, fileId, filename, mimeType, buffer, size);
      }
    }

    // Save record to DB
    return this.prisma.storageFile.create({
      data: {
        id: fileId,
        filename,
        mimeType,
        size,
        driver,
        path: storagePath,
        entityId: entityId || null,
        entityType: entityType || null,
        uploadedById: userId,
      },
    });
  }

  // Graceful fallback helper when active driver credentials are missing
  private async uploadFileWithFallback(
    fallbackDriver: 'DATABASE' | 'NAS',
    base64DataUrl: string,
    userId: string,
    entityId: string,
    entityType: string,
    fileId: string,
    filename: string,
    mimeType: string,
    buffer: Buffer,
    size: number,
  ) {
    let storagePath = '';
    
    if (fallbackDriver === 'DATABASE') {
      storagePath = base64DataUrl;
    } else {
      const nasFolder = this.defaultNasPath;
      if (!fs.existsSync(nasFolder)) {
        fs.mkdirSync(nasFolder, { recursive: true });
      }
      const physicalName = `${fileId}-${filename}`;
      const fullPath = path.join(nasFolder, physicalName);
      fs.writeFileSync(fullPath, buffer);
      storagePath = fullPath;
    }

    return this.prisma.storageFile.create({
      data: {
        id: fileId,
        filename,
        mimeType,
        size,
        driver: fallbackDriver,
        path: storagePath,
        entityId: entityId || null,
        entityType: entityType || null,
        uploadedById: userId,
      },
    });
  }

  // Unified download streaming proxy:
  // Streams file binary from S3, GDrive, NAS, or Database directly to the Express Response
  async downloadFile(id: string) {
    const file = await this.prisma.storageFile.findUnique({
      where: { id },
    });

    if (!file) {
      throw new NotFoundException(`File with ID ${id} not found`);
    }

    let stream: any;
    let size = file.size;

    if (file.driver === 'DATABASE') {
      const parts = file.path.split(';base64,');
      const base64Data = parts[1];
      const buffer = Buffer.from(base64Data, 'base64');
      stream = buffer;
    } else if (file.driver === 'NAS') {
      if (!fs.existsSync(file.path)) {
        throw new NotFoundException('Physical file not found on NAS storage');
      }
      stream = fs.createReadStream(file.path);
    } else if (file.driver === 'S3') {
      const config = await this.getConfig();
      const s3Config = config.s3;
      const key = file.path.replace(/^s3:\/\/[^/]+\//, '');
      const url = `${s3Config.endpoint.replace(/\/$/, '')}/${s3Config.bucket}/${key}`;

      try {
        const res = await axios.get(url, { responseType: 'stream' });
        stream = res.data;
      } catch (err) {
        throw new NotFoundException(`Failed to retrieve file from S3: ${err.message}`);
      }
    } else if (file.driver === 'GOOGLE_DRIVE') {
      const config = await this.getConfig();
      const driveConfig = config.googleDrive;
      const fileId = file.path.replace('drive://', '');

      try {
        // Get access token
        const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
          client_id: driveConfig.clientId,
          client_secret: driveConfig.clientSecret,
          refresh_token: driveConfig.refreshToken,
          grant_type: 'refresh_token',
        });
        const accessToken = tokenRes.data.access_token;

        const res = await axios.get(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          responseType: 'stream',
        });
        stream = res.data;
      } catch (err) {
        throw new NotFoundException(`Failed to retrieve file from Google Drive: ${err.message}`);
      }
    }

    return {
      stream,
      filename: file.filename,
      mimeType: file.mimeType,
      size,
    };
  }

  // Delete storage file permanently
  async deleteFile(id: string) {
    const file = await this.prisma.storageFile.findUnique({
      where: { id },
    });

    if (!file) {
      throw new NotFoundException(`File with ID ${id} not found`);
    }

    if (file.driver === 'NAS') {
      try {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      } catch (err) {
        this.logger.error(`Failed to delete physical NAS file: ${err.message}`);
      }
    } else if (file.driver === 'S3') {
      try {
        const config = await this.getConfig();
        const s3Config = config.s3;
        const key = file.path.replace(/^s3:\/\/[^/]+\//, '');
        const url = `${s3Config.endpoint.replace(/\/$/, '')}/${s3Config.bucket}/${key}`;
        await axios.delete(url);
      } catch (err) {
        this.logger.error(`Failed to delete S3 asset: ${err.message}`);
      }
    } else if (file.driver === 'GOOGLE_DRIVE') {
      try {
        const config = await this.getConfig();
        const driveConfig = config.googleDrive;
        const fileId = file.path.replace('drive://', '');
        
        const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
          client_id: driveConfig.clientId,
          client_secret: driveConfig.clientSecret,
          refresh_token: driveConfig.refreshToken,
          grant_type: 'refresh_token',
        });
        const accessToken = tokenRes.data.access_token;

        await axios.delete(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      } catch (err) {
        this.logger.error(`Failed to delete Google Drive asset: ${err.message}`);
      }
    }

    return this.prisma.storageFile.delete({
      where: { id },
    });
  }

  // List all registered files inside database
  async listFiles(
    user: any,
    query: string = '',
    driver: string = '',
    extension: string = '',
    category: string = '',
    page?: number,
    limit?: number,
  ) {
    const isAdmin = user.roles?.some((r: any) => r.role.name === 'ADMIN');
    
    // Non-admins can ONLY see their own files
    const where: any = isAdmin ? {} : {
      uploadedById: user.id
    };

    if (query) {
      where.filename = { contains: query, mode: 'insensitive' };
    }

    if (driver && driver !== 'ALL') {
      where.driver = driver;
    }

    if (extension && extension !== 'ALL') {
      where.filename = {
        ...where.filename,
        endsWith: `.${extension}`,
        mode: 'insensitive',
      };
    }

    // Helper to determine category from mimeType
    const getFileCategory = (mime: string): 'IMAGE' | 'DOCUMENT' | 'ARCHIVE' | 'OTHER' => {
      const m = mime.toLowerCase();
      if (m.startsWith('image/')) return 'IMAGE';
      if (
        m.startsWith('application/pdf') ||
        m.includes('word') ||
        m.includes('excel') ||
        m.includes('sheet') ||
        m.startsWith('text/')
      ) {
        return 'DOCUMENT';
      }
      if (m.includes('zip') || m.includes('tar') || m.includes('rar') || m.includes('gzip')) {
        return 'ARCHIVE';
      }
      return 'OTHER';
    };

    // First fetch all files matching the filters (excluding category and page/limit) to calculate counts and metrics
    const allMatchingFiles = await this.prisma.storageFile.findMany({
      where,
      select: {
        id: true,
        mimeType: true,
        driver: true,
        size: true,
      },
    });

    // Calculate counts
    const counts = {
      ALL: allMatchingFiles.length,
      IMAGE: 0,
      DOCUMENT: 0,
      ARCHIVE: 0,
      OTHER: 0,
    };

    // Calculate metrics
    const metrics = {
      totalBytesUsed: 0,
      dbBytes: 0,
      nasBytes: 0,
      s3Bytes: 0,
      gdriveBytes: 0,
    };

    for (const file of allMatchingFiles) {
      const cat = getFileCategory(file.mimeType);
      counts[cat]++;

      metrics.totalBytesUsed += file.size;
      if (file.driver === 'DATABASE') metrics.dbBytes += file.size;
      else if (file.driver === 'NAS') metrics.nasBytes += file.size;
      else if (file.driver === 'S3') metrics.s3Bytes += file.size;
      else if (file.driver === 'GOOGLE_DRIVE') metrics.gdriveBytes += file.size;
    }

    // Apply category filter for data retrieval
    if (category && category !== 'ALL') {
      if (category === 'IMAGE') {
        where.mimeType = { startsWith: 'image/', mode: 'insensitive' };
      } else if (category === 'DOCUMENT') {
        where.OR = [
          { mimeType: { startsWith: 'text/', mode: 'insensitive' } },
          { mimeType: { contains: 'pdf', mode: 'insensitive' } },
          { mimeType: { contains: 'word', mode: 'insensitive' } },
          { mimeType: { contains: 'excel', mode: 'insensitive' } },
          { mimeType: { contains: 'sheet', mode: 'insensitive' } },
          { mimeType: { contains: 'document', mode: 'insensitive' } },
        ];
      } else if (category === 'ARCHIVE') {
        where.OR = [
          { mimeType: { contains: 'zip', mode: 'insensitive' } },
          { mimeType: { contains: 'tar', mode: 'insensitive' } },
          { mimeType: { contains: 'rar', mode: 'insensitive' } },
          { mimeType: { contains: 'gzip', mode: 'insensitive' } },
        ];
      } else if (category === 'OTHER') {
        where.NOT = [
          { mimeType: { startsWith: 'image/', mode: 'insensitive' } },
          { mimeType: { startsWith: 'text/', mode: 'insensitive' } },
          { mimeType: { contains: 'pdf', mode: 'insensitive' } },
          { mimeType: { contains: 'word', mode: 'insensitive' } },
          { mimeType: { contains: 'excel', mode: 'insensitive' } },
          { mimeType: { contains: 'sheet', mode: 'insensitive' } },
          { mimeType: { contains: 'document', mode: 'insensitive' } },
          { mimeType: { contains: 'zip', mode: 'insensitive' } },
          { mimeType: { contains: 'tar', mode: 'insensitive' } },
          { mimeType: { contains: 'rar', mode: 'insensitive' } },
          { mimeType: { contains: 'gzip', mode: 'insensitive' } },
        ];
      }
    }

    // Determine the count after applying the category filter
    const totalFiltered = category && category !== 'ALL'
      ? await this.prisma.storageFile.count({ where })
      : allMatchingFiles.length;

    // Fetch the paginated data
    const skip = page && limit ? (page - 1) * limit : undefined;
    const take = limit || undefined;

    const data = await this.prisma.storageFile.findMany({
      where,
      include: {
        uploadedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take,
    });

    return {
      data,
      total: totalFiltered,
      page: page || 1,
      limit: limit || data.length,
      totalPages: limit ? Math.ceil(totalFiltered / limit) : 1,
      counts,
      metrics,
    };
  }
}
