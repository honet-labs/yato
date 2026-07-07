import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class VmInventoryService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async findAll(userId?: string) {
    const where = userId ? { request: { requestedBy: userId } } : {};
    const inventory = await this.prisma.vMInventory.findMany({
      where,
      include: { 
        request: {
          include: { user: true }
        }
      },
    });

    // Auto-repair: If has IP but status is PROVISIONING, it should be RUNNING
    for (const item of inventory) {
      if (item.ipAddress && item.status === 'PROVISIONING') {
        await this.prisma.vMInventory.update({
          where: { id: item.id },
          data: { status: 'RUNNING' }
        });
        item.status = 'RUNNING';
      }
    }

    return inventory.map(item => ({
      id: item.id,
      ticketId: item.request.ticketId,
      hostname: item.request.hostname,
      ip: item.ipAddress || 'PENDING',
      os: item.request.osTemplate,
      cpu: item.request.cpu,
      ram: item.request.ram,
      disk: item.request.disk,
      status: item.status,
      sshUser: item.sshUser,
      sshPassword: item.sshPassword ? '••••••••••••' : null,
      sshPort: item.sshPort,
      environment: item.request.environment,
      requestedBy: item.request.user.fullName,
      notes: item.request.notes,
      createdAt: item.createdAt,
    }));
  }

  async findById(id: string) {
    const item = await this.prisma.vMInventory.findUnique({
      where: { id },
      include: { request: true },
    });
    if (!item) return null;

    return {
      id: item.id,
      hostname: item.request.hostname,
      ip: item.ipAddress || 'PENDING',
      os: item.request.osTemplate,
      cpu: item.request.cpu,
      ram: item.request.ram,
      disk: item.request.disk,
      status: item.status,
      sshUser: item.sshUser,
      createdAt: item.createdAt,
    };
  }

  async delete(id: string) {
    const item = await this.prisma.vMInventory.findUnique({
      where: { id },
    });
    if (!item) return;

    await this.prisma.vMInventory.delete({
      where: { id },
    });

    await this.prisma.vMRequest.update({
      where: { id: item.requestId },
      data: { status: 'FAILED' },
    });

    return { success: true };
  }

  async updateConfig(id: string, data: any) {
    const item = await this.prisma.vMInventory.findUnique({
      where: { id },
      include: { request: true },
    });
    if (!item) return;

    return this.prisma.vMRequest.update({
      where: { id: item.requestId },
      data: {
        cpu: data.cpu,
        ram: data.ram,
        disk: data.disk,
      },
    });
  }

  private async generateTicketId() {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    const startOfDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59, 999));

    const count = await this.prisma.vMRequest.count({
      where: {
        createdAt: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
    });
    const sequence = (count + 1).toString().padStart(4, '0');
    return `VM-${dateStr}-${sequence}`;
  }

  async create(data: any, userId: string) {
    const ticketId = await this.generateTicketId();
    
    // Create the VM Request as completed/approved
    const request = await this.prisma.vMRequest.create({
      data: {
        ticketId,
        hostname: data.hostname,
        cpu: parseInt(data.cpu),
        ram: parseInt(data.ram),
        disk: parseInt(data.disk),
        osTemplate: data.osTemplate,
        hypervisor: data.hypervisor || 'manual',
        environment: data.environment || 'Production',
        notes: data.notes || '',
        status: 'APPROVED',
        requestedBy: userId,
        approvedBy: userId,
        approvedAt: new Date()
      }
    });

    // Create the VM Inventory entry
    return this.prisma.vMInventory.create({
      data: {
        requestId: request.id,
        ipAddress: data.ipAddress || null,
        sshUser: data.sshUser || null,
        sshPassword: data.sshPassword || null,
        sshPort: data.sshPort ? parseInt(data.sshPort) : 22,
        status: 'RUNNING'
      }
    });
  }

  async revealSecret(id: string, userId: string) {
    const item = await this.prisma.vMInventory.findUnique({
      where: { id },
      include: { request: true },
    });
    if (!item) throw new NotFoundException('VM inventory item not found');

    try {
      await this.auditService.log(userId, 'REVEAL_VM_SECRET', 'VMInventory', id);
    } catch (auditError) {
      console.error('Failed to log audit:', auditError.message);
    }

    return {
      id: item.id,
      sshPassword: item.sshPassword ? this.encryptionService.decrypt(item.sshPassword) : null,
    };
  }
}
