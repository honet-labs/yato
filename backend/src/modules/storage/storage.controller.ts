import { Controller, Get, Post, Delete, Body, Param, Query, Res, UseGuards, Request, HttpStatus } from '@nestjs/common';
import { StorageService } from './storage.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateStorageConfigDto } from './dto/storage.dto';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('storage')
@ApiBearerAuth()
@Controller('storage')
export class StorageController {
  constructor(private storageService: StorageService) {}

  @Get('files')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List all platform storage files' })
  async list(
    @Request() req: any,
    @Query('query') query?: string,
    @Query('driver') driver?: string,
    @Query('extension') extension?: string,
    @Query('category') category?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.storageService.listFiles(
      req.user,
      query,
      driver,
      extension,
      category,
      page ? parseInt(page, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Get('config')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Fetch platform active storage configurations' })
  async getConfig() {
    return this.storageService.getConfig();
  }

  @Post('config')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Save platform active storage credentials' })
  async saveConfig(@Body() dto: UpdateStorageConfigDto) {
    return this.storageService.saveConfig(dto);
  }

  @Delete('files/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Permanently delete uploaded file asset' })
  async deleteFile(@Param('id') id: string) {
    return this.storageService.deleteFile(id);
  }

  // PUBLIC STREAMING DOWNLOAD GATEWAY
  @Get('download/:id')
  @ApiOperation({ summary: 'Secure proxy download gateway for S3/Drive/NAS/Database' })
  async download(@Param('id') id: string, @Res() res: Response) {
    try {
      const file = await this.storageService.downloadFile(id);
      
      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Content-Length', file.size);
      
      const isImage = file.mimeType.toLowerCase().startsWith('image/');
      res.setHeader('Content-Disposition', `${isImage ? 'inline' : 'attachment'}; filename="${encodeURIComponent(file.filename)}"`);
      
      if (Buffer.isBuffer(file.stream)) {
        res.send(file.stream);
      } else {
        file.stream.on('error', (err: any) => {
          res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({ message: 'Error streaming file content' });
        });
        file.stream.pipe(res);
      }
    } catch (error) {
      res.status(HttpStatus.NOT_FOUND).send({ message: error.message || 'File not found' });
    }
  }
}
