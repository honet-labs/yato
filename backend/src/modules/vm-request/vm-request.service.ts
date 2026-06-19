import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVmRequestDto } from './dto/vm-request.dto';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class VmRequestService {
  private readonly logger = new Logger(VmRequestService.name);

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private notificationService: NotificationService,
    @InjectQueue('vm-provisioning') private vmQueue: Queue,
  ) {}

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

  private async getFrontendUrl() {
    const platformUrlSetting = await this.prisma.systemSetting.findUnique({
      where: { key: 'PLATFORM_URL' }
    });
    return (platformUrlSetting?.value as string) || process.env.FRONTEND_URL || 'https://yato.honet.web.id';
  }

  async create(dto: CreateVmRequestDto, userId: string) {
    const ticketId = await this.generateTicketId();
    
    // Ensure data mapping is correct for Prisma
    const request = await this.prisma.vMRequest.create({
      data: {
        ticketId,
        hostname: dto.hostname,
        cpu: dto.cpu,
        ram: dto.ram,
        disk: dto.disk,
        osTemplate: dto.osTemplate,
        hypervisor: dto.hypervisor,
        environment: dto.environment,
        notes: dto.notes,
        status: 'PENDING',
        user: { connect: { id: userId } } // Correct Prisma relation connection
      },
    });

    const frontendUrl = await this.getFrontendUrl();
    const ticketUrl = `${frontendUrl}/tickets?id=${request.id}&type=VM`;

    // Notify requester
    try {
      await this.notificationService.sendToUserQueue(
        userId,
        `VM Request Created: ${ticketId}`,
        `Your VM provisioning request <b>${ticketId}</b> for hostname <b>${dto.hostname}</b> has been successfully created. Status: PENDING.\n\nLink: ${ticketUrl}`,
      );
    } catch (err) {
      // Safe catch
    }

    // Notify routed admins based on dynamic notification rules
    try {
      const recipients = await this.notificationService.getRecipientsForTicket({
        type: 'VM',
        category: 'INFRASTRUCTURE',
        priority: 'NORMAL',
        excludeUserId: userId
      });
      const requester = await this.prisma.user.findUnique({ where: { id: userId } });
      const requesterName = requester?.fullName || 'A user';

      for (const recipient of recipients) {
        await this.notificationService.sendToUserQueue(
          recipient.id,
          `New VM Request: ${ticketId}`,
          `A new VM provisioning request <b>${ticketId}</b> for hostname <b>${dto.hostname}</b> has been submitted by <b>${requesterName}</b>.\n\nLink: ${ticketUrl}`,
        );
      }
    } catch (err) {
      // Safe catch
    }

    await this.auditService.log(
      userId,
      'CREATE_VM_REQUEST',
      'VMRequest',
      request.id,
      { ...dto, ticketId },
    );

    return request;
  }

  async findAll(user: any) {
    const isAdmin = user.roles?.some(r => r.role.name === 'ADMIN' || r.role.name === 'TICKETING_ADMIN');
    
    const where = isAdmin ? {} : {
      OR: [
        { requestedBy: user.id },
        { followers: { some: { id: user.id } } }
      ]
    };

    return this.prisma.vMRequest.findMany({
      where,
      include: { 
        user: { select: { fullName: true, email: true } },
        admin: { select: { fullName: true } },
        followers: { select: { id: true, fullName: true } },
        comments: { select: { id: true, authorId: true, createdAt: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async addFollower(ticketId: string, userId: string) {
    try {
      const ticket = await this.prisma.vMRequest.findUnique({ where: { id: ticketId } });
      if (ticket) {
        const frontendUrl = await this.getFrontendUrl();
        const ticketUrl = `${frontendUrl}/tickets?id=${ticket.id}&type=VM`;
        await this.notificationService.sendToUserQueue(
          userId,
          `Follower Added: ${ticket.ticketId}`,
          `You have been added as a follower to VM request <b>${ticket.ticketId}</b> for hostname <b>${ticket.hostname}</b>.\n\nLink: ${ticketUrl}`,
        );
      }
    } catch (err) {
      // Safe catch
    }

    return this.prisma.vMRequest.update({
      where: { id: ticketId },
      data: { followers: { connect: { id: userId } } }
    });
  }

  async removeFollower(ticketId: string, userId: string) {
    return this.prisma.vMRequest.update({
      where: { id: ticketId },
      data: { followers: { disconnect: { id: userId } } }
    });
  }

  async approve(id: string, adminId: string, dto?: any) {
    const request = await this.prisma.vMRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Request not found');

    const updated = await this.prisma.vMRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy: adminId,
        approvedAt: new Date(),
      },
    });

    // Check if automated provisioning is enabled
    const autoProv = await this.prisma.systemSetting.findUnique({ 
      where: { key: 'AUTOMATED_PROVISIONING_ENABLED' } 
    });
    
    const isAutoEnabled = autoProv 
      ? (typeof autoProv.value === 'object' && autoProv.value !== null && 'enabled' in (autoProv.value as any))
        ? (autoProv.value as any).enabled
        : !!autoProv.value
      : true;

    // Create Inventory Entry
    await this.prisma.vMInventory.create({
      data: {
        requestId: id,
        ipAddress: dto?.ipAddress,
        sshUser: dto?.sshUser,
        sshPassword: dto?.sshPassword,
        sshPort: dto?.sshPort ? parseInt(dto.sshPort) : 22,
        status: isAutoEnabled ? 'PROVISIONING' : (dto?.ipAddress ? 'RUNNING' : 'AWAITING_CONFIG')
      }
    });

    await this.auditService.log(adminId, 'APPROVE_VM_REQUEST', 'VMRequest', id, dto);

    if (isAutoEnabled) {
      // Push to Queue for automated provisioning
      await this.vmQueue.add('provision-vm', {
        requestId: id,
        ticketId: request.ticketId,
        hostname: request.hostname,
        specs: { cpu: request.cpu, ram: request.ram, disk: request.disk },
      });
    } else {
      this.logger.log(`Automated provisioning is disabled. Request ${id} handled ${dto?.ipAddress ? 'manually' : 'partially'}.`);
    }

    // Add automatic comment to conversation thread
    await this.prisma.ticketComment.create({
      data: {
        content: `Ticket has been APPROVED ${isAutoEnabled ? 'and is now being PROVISIONED' : (dto?.ipAddress ? `manually (IP: ${dto.ipAddress})` : 'but requires manual configuration')}.`,
        vmRequestId: id,
        authorId: adminId,
      }
    });
    // Notify requester
    const frontendUrl = await this.getFrontendUrl();
    const ticketUrl = `${frontendUrl}/tickets?id=${id}&type=VM`;
    try {
      await this.notificationService.sendToUserQueue(
        request.requestedBy,
        `VM Request Approved: ${request.ticketId}`,
        `Your request <b>${request.ticketId}</b> for hostname <b>${request.hostname}</b> has been approved.\n\nLink: ${ticketUrl}`,
        `/tickets?id=${id}&type=VM`
      );
    } catch (err) {
      // Safe catch
    }
    return updated;
  }

  async reject(id: string, adminId: string, reason: string) {
    const request = await this.prisma.vMRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Request not found');

    const updated = await this.prisma.vMRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason: reason,
      },
    });

    await this.auditService.log(adminId, 'REJECT_VM_REQUEST', 'VMRequest', id, { reason });

    // Add automatic comment to conversation thread
    await this.prisma.ticketComment.create({
      data: {
        content: `Ticket has been REJECTED. Reason: ${reason}`,
        vmRequestId: id,
        authorId: adminId,
      }
    });

    // Notify requester
    const frontendUrl = await this.getFrontendUrl();
    const ticketUrl = `${frontendUrl}/tickets?id=${id}&type=VM`;
    try {
      await this.notificationService.sendToUserQueue(
        request.requestedBy,
        `VM Request Rejected: ${request.ticketId}`,
        `Your request <b>${request.ticketId}</b> for hostname <b>${request.hostname}</b> was rejected: ${reason}\n\nLink: ${ticketUrl}`,
        `/tickets?id=${id}&type=VM`
      );
    } catch (err) {
      // Safe catch
    }

    return updated;
  }

  async update(id: string, dto: any, userId: string) {
    const request = await this.prisma.vMRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Request not found');

    if (dto.status === 'APPROVED' && request.status === 'PENDING') {
      return this.approve(id, userId, dto);
    }
    if (dto.status === 'REJECTED' && request.status === 'PENDING') {
      return this.reject(id, userId, dto.rejectionReason || 'Status updated to REJECTED via edit');
    }

    const updated = await this.prisma.vMRequest.update({
      where: { id },
      data: {
        hostname: dto.hostname,
        cpu: dto.cpu,
        ram: dto.ram,
        disk: dto.disk,
        osTemplate: dto.osTemplate,
        hypervisor: dto.hypervisor,
        environment: dto.environment,
        notes: dto.notes,
        status: dto.status,
        attachments: dto.attachments,
      },
    });

    await this.auditService.log(userId, 'UPDATE_VM_REQUEST', 'VMRequest', id, dto);
    return updated;
  }

  async findOne(id: string) {
    const request = await this.prisma.vMRequest.findUnique({
      where: { id },
      include: {
        user: { select: { fullName: true, email: true } },
        admin: { select: { fullName: true } },
        followers: { select: { id: true, fullName: true } }
      },
    });
    if (!request) throw new NotFoundException('Request not found');
    return request;
  }

  async deleteRequest(id: string, userId: string) {
    const request = await this.prisma.vMRequest.findUnique({
      where: { id },
      include: { followers: { select: { id: true } } },
    });
    if (!request) throw new NotFoundException('VM Request not found');

    // 1. Delete associated VMInventory if it exists
    await this.prisma.vMInventory.deleteMany({
      where: { requestId: id },
    });

    // 2. Disconnect followers
    if (request.followers.length > 0) {
      await this.prisma.vMRequest.update({
        where: { id },
        data: {
          followers: {
            disconnect: request.followers.map(f => ({ id: f.id })),
          },
        },
      });
    }

    // Delete all related notifications
    await this.prisma.notification.deleteMany({
      where: {
        link: {
          contains: id,
        },
      },
    });

    // 3. Delete the VM Request (comments cascade-delete automatically via prisma schema)
    await this.prisma.vMRequest.delete({
      where: { id },
    });

    // 4. Log deletion to audit activity
    await this.auditService.log(
      userId,
      'DELETE_VM_REQUEST',
      'VMRequest',
      id,
      { ticketId: request.ticketId, hostname: request.hostname, environment: request.environment },
    );

    return { success: true, message: `VM Request ${request.ticketId} has been permanently deleted.` };
  }
}
