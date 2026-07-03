import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ServiceInventoryService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async findAll(userId?: string) {
    const where = userId ? { request: { requestedBy: userId } } : {};
    const items = await this.prisma.serviceInventory.findMany({
      where,
      include: { 
        request: {
          include: { user: true }
        }
      },
    });
    
    return items.map(item => ({
      id: item.id,
      ticketId: item.request.ticketId,
      serviceName: item.request.serviceName,
      version: item.request.version,
      environment: item.request.environment,
      endpoint: item.endpoint,
      address: item.address,
      port: item.port,
      username: item.username,
      password: item.password ? '••••••••••••' : null,
      status: item.status,
      requestedBy: item.request.user.fullName,
      createdAt: item.createdAt,
    }));
  }

  async findByRequestId(requestId: string) {
    const item = await this.prisma.serviceInventory.findUnique({
      where: { requestId },
      include: { request: true },
    });
    if (!item) throw new NotFoundException('Service inventory item not found');
    
    return {
      id: item.id,
      serviceName: item.request.serviceName,
      version: item.request.version,
      environment: item.request.environment,
      endpoint: item.endpoint,
      address: item.address,
      port: item.port,
      username: item.username,
      password: item.password ? '••••••••••••' : null,
      status: item.status,
      createdAt: item.createdAt,
    };
  }

  async update(id: string, data: any) {
    const item = await this.prisma.serviceInventory.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Service inventory item not found');

    return this.prisma.serviceInventory.update({
      where: { id },
      data: {
        address: data.address,
        port: data.port ? parseInt(data.port) : null,
        username: data.username,
        password: data.password,
        endpoint: data.endpoint,
        status: data.status || 'COMPLETED',
      },
    });
  }

  private async generateTicketId() {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    const startOfDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59, 999));

    const count = await this.prisma.serviceRequest.count({
      where: {
        createdAt: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
    });
    const sequence = (count + 1).toString().padStart(4, '0');
    return `SVC-${dateStr}-${sequence}`;
  }

  async create(data: any, userId: string) {
    const ticketId = await this.generateTicketId();
    
    const request = await this.prisma.serviceRequest.create({
      data: {
        ticketId,
        serviceName: data.serviceName,
        environment: data.environment || 'Production',
        version: data.version || '1.0.0',
        config: data.config || {},
        requestedBy: userId,
        status: 'APPROVED',
        approvedBy: userId,
        approvedAt: new Date()
      }
    });

    return this.prisma.serviceInventory.create({
      data: {
        requestId: request.id,
        endpoint: data.endpoint || null,
        address: data.address || null,
        port: data.port ? parseInt(data.port) : null,
        username: data.username || null,
        password: data.password || null,
        status: 'COMPLETED'
      }
    });
  }

  async revealSecret(id: string, userId: string) {
    const item = await this.prisma.serviceInventory.findUnique({
      where: { id },
      include: { request: true },
    });
    if (!item) throw new NotFoundException('Service inventory item not found');

    try {
      await this.auditService.log(userId, 'REVEAL_SERVICE_SECRET', 'ServiceInventory', id);
    } catch (auditError) {
      console.error('Failed to log audit:', auditError.message);
    }

    return {
      id: item.id,
      password: item.password,
    };
  }
}
