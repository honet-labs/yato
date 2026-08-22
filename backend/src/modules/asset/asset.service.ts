import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AssetCodeService } from './services/asset-code.service';
import { QrGeneratorService } from './services/qr-generator.service';
import { AssetGateway } from './asset.gateway';
import { CreateAssetDto, UpdateAssetDto, CreateAssetRelationshipDto } from './dto/asset.dto';

@Injectable()
export class AssetService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private assetCodeService: AssetCodeService,
    private qrGeneratorService: QrGeneratorService,
    private assetGateway: AssetGateway,
  ) {}

  async findAll(search?: string, type?: string, status?: string) {
    const where: any = { deletedAt: null };

    if (type) {
      where.assetType = type;
    }
    if (status) {
      where.status = status;
    }
    if (search) {
      const s = search.trim();
      where.OR = [
        { assetCode: { contains: s, mode: 'insensitive' } },
        { hostname: { contains: s, mode: 'insensitive' } },
        { serialNumber: { contains: s, mode: 'insensitive' } },
        { location: { contains: s, mode: 'insensitive' } },
        { rack: { contains: s, mode: 'insensitive' } },
      ];
    }

    const assets = await this.prisma.asset.findMany({
      where,
      include: {
        owner: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return assets;
  }

  async findByCode(assetCode: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { assetCode },
      include: {
        owner: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        movements: {
          orderBy: { timestamp: 'desc' },
        },
      },
    });

    if (!asset || asset.deletedAt) {
      throw new NotFoundException(`Asset with code ${assetCode} not found`);
    }

    return asset;
  }

  async findById(id: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        movements: {
          orderBy: { timestamp: 'desc' },
        },
      },
    });

    if (!asset || asset.deletedAt) {
      throw new NotFoundException(`Asset with ID ${id} not found`);
    }

    return asset;
  }

  async create(dto: CreateAssetDto, userId: string) {
    // 1. Generate unique readable Asset Code
    const assetCode = await this.assetCodeService.generateCode(dto.assetType);

    // 2. Generate secure QR DataURL containing ONLY plain-text assetCode
    const qrCodeUrl = await this.qrGeneratorService.generateQrCodeDataUrl(assetCode);

    // 3. Create transactional database records
    const asset = await this.prisma.$transaction(async (tx) => {
      const newAsset = await tx.asset.create({
        data: {
          assetCode,
          assetType: dto.assetType.toUpperCase(),
          hostname: dto.hostname,
          serialNumber: dto.serialNumber,
          status: dto.status || 'RECEIVED',
          location: dto.location,
          rack: dto.rack,
          uPosition: dto.uPosition,
          ownerId: dto.ownerId || null,
          qrCodeUrl,
          metadata: dto.metadata,
          healthStatus: 'HEALTHY',
          uptime: 100.0,
          lastSeen: new Date(),
        },
      });

      // Write initial relocation movement log
      await tx.assetMovement.create({
        data: {
          assetId: newAsset.id,
          userId,
          action: 'CREATE',
          toLocation: dto.location || 'N/A',
          toRack: dto.rack || 'N/A',
          notes: 'Asset registered in secure registry',
        },
      });

      return newAsset;
    });

    // 4. Integrasi Audit Ledger
    await this.auditService.log(userId, 'CREATE_ASSET', 'Asset', asset.id, { assetCode });

    // 5. Broadcast websocket update
    this.assetGateway.broadcast('assetCreated', asset);

    return asset;
  }

  async update(id: string, dto: UpdateAssetDto, userId: string) {
    const existing = await this.findById(id);

    // Track relocation movements for movement history ledger
    const locationChanged = dto.location !== undefined && dto.location !== existing.location;
    const rackChanged = dto.rack !== undefined && dto.rack !== existing.rack;
    const statusChanged = dto.status !== undefined && dto.status !== existing.status;
    const ownerChanged = dto.ownerId !== undefined && dto.ownerId !== existing.ownerId;

    const asset = await this.prisma.$transaction(async (tx) => {
      const updatedAsset = await tx.asset.update({
        where: { id },
        data: {
          assetType: dto.assetType ? dto.assetType.toUpperCase() : undefined,
          hostname: dto.hostname,
          serialNumber: dto.serialNumber,
          status: dto.status,
          location: dto.location,
          rack: dto.rack,
          uPosition: dto.uPosition,
          ownerId: dto.ownerId || null,
          metadata: dto.metadata,
        },
      });

      if (locationChanged || rackChanged) {
        await tx.assetMovement.create({
          data: {
            assetId: id,
            userId,
            action: 'RELOCATE',
            fromLocation: existing.location,
            toLocation: dto.location || existing.location,
            fromRack: existing.rack,
            toRack: dto.rack || existing.rack,
            notes: `Relocated from datacenter rack.`,
          },
        });
      }

      if (statusChanged) {
        await tx.assetMovement.create({
          data: {
            assetId: id,
            userId,
            action: 'STATUS_CHANGE',
            notes: `Lifecycle status updated to ${dto.status}.`,
          },
        });
      }

      if (ownerChanged) {
        await tx.assetMovement.create({
          data: {
            assetId: id,
            userId,
            action: 'OWNER_CHANGE',
            notes: `Asset assignment ownership modified.`,
          },
        });
      }

      return updatedAsset;
    });

    await this.auditService.log(userId, 'UPDATE_ASSET', 'Asset', id, { dto });
    this.assetGateway.broadcast('assetUpdated', asset);

    return asset;
  }

  async delete(id: string, userId: string) {
    await this.findById(id);

    const asset = await this.prisma.asset.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    await this.auditService.log(userId, 'DELETE_ASSET', 'Asset', id, { assetCode: asset.assetCode });
    this.assetGateway.broadcast('assetDeleted', { id });

    return { success: true };
  }

  // Monitoring Sync (Simulated PandoraFMS Zabbix sync metrics)
  private async syncMonitoringMetrics(assetId: string) {
    try {
      const randomCpu = parseFloat((Math.random() * 80 + 5).toFixed(1)); // 5% to 85%
      const randomMem = parseFloat((Math.random() * 70 + 10).toFixed(1)); // 10% to 80%
      const isDegraded = randomCpu > 80;
      const health = isDegraded ? 'WARNING' : 'HEALTHY';

      // We only update dynamically every query to simulate real collector metrics
      await this.prisma.asset.update({
        where: { id: assetId },
        data: {
          lastSeen: new Date(),
          cpuUsage: randomCpu,
          memoryUsage: randomMem,
          healthStatus: health,
          uptime: 99.98,
        },
      });
    } catch (e) {
      // Defensively catch to prevent query failure on offline DB
    }
  }

  // CMDB Generic Relationship mapping
  async addRelationship(dto: CreateAssetRelationshipDto, userId: string) {
    if (dto.sourceId === dto.targetId) {
      throw new BadRequestException('An asset cannot relate to itself');
    }

    const rel = await this.prisma.assetRelationship.create({
      data: {
        sourceId: dto.sourceId,
        targetId: dto.targetId,
        type: dto.type,
      },
      include: {
        source: true,
        target: true,
      },
    });

    await this.auditService.log(userId, 'ADD_CMDB_RELATION', 'AssetRelationship', rel.id, { dto });
    return rel;
  }

  async getRelationships(assetId: string) {
    return this.prisma.assetRelationship.findMany({
      where: {
        OR: [
          { sourceId: assetId },
          { targetId: assetId },
        ],
      },
      include: {
        source: true,
        target: true,
      },
    });
  }

  async deleteRelationship(id: string, userId: string) {
    const rel = await this.prisma.assetRelationship.delete({
      where: { id },
    });

    await this.auditService.log(userId, 'REMOVE_CMDB_RELATION', 'AssetRelationship', id, { rel });
    return { success: true };
  }

  async logExport(userId: string, count: number) {
    await this.auditService.log(
      userId,
      'EXPORT_ASSETS',
      'Asset',
      'all',
      { recordCount: count }
    );
    return { success: true };
  }
}
