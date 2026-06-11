import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';
import { ApproveServiceRequestDto, CreateServiceRequestDto } from './dto/service-request.dto';

@Injectable()
export class ServiceRequestService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private notificationService: NotificationService,
  ) {}

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

  async create(dto: CreateServiceRequestDto, userId: string) {
    const ticketId = await this.generateTicketId();

    const request = await this.prisma.serviceRequest.create({
      data: {
        ticketId,
        serviceName: dto.serviceName,
        environment: dto.environment,
        version: dto.type,
        config: dto.config || {},
        requestedBy: userId,
        status: 'PENDING',
      },
    });

    const platformUrlSetting = await this.prisma.systemSetting.findUnique({
      where: { key: 'PLATFORM_URL' }
    });
    const frontendUrl = (platformUrlSetting?.value as string) || process.env.FRONTEND_URL || 'https://yato.honet.web.id';
    const ticketUrl = `${frontendUrl}/tickets?id=${request.id}&type=SERVICE`;

    // Notify requester
    try {
      await this.notificationService.sendToUserQueue(
        userId,
        `Service Request Created: ${ticketId}`,
        `Your access service request <b>${ticketId}</b> for service <b>${dto.serviceName}</b> has been successfully created. Status: PENDING.\n\nLink: ${ticketUrl}`,
      );
    } catch (err) {
      // Safe catch
    }

    // Notify routed admins based on dynamic notification rules
    try {
      const recipients = await this.notificationService.getRecipientsForTicket({
        type: 'SERVICE',
        category: dto.serviceName || 'GENERAL',
        priority: 'NORMAL',
        excludeUserId: userId
      });
      const requester = await this.prisma.user.findUnique({ where: { id: userId } });
      const requesterName = requester?.fullName || 'A user';

      for (const recipient of recipients) {
        await this.notificationService.sendToUserQueue(
          recipient.id,
          `New Service Request: ${ticketId}`,
          `A new service request <b>${ticketId}</b> for service <b>${dto.serviceName}</b> has been submitted by <b>${requesterName}</b>.\n\nLink: ${ticketUrl}`,
        );
      }
    } catch (err) {
      // Safe catch
    }

    await this.auditService.log(
      userId,
      'CREATE_SERVICE_REQUEST',
      'ServiceRequest',
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

    return this.prisma.serviceRequest.findMany({
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
      const ticket = await this.prisma.serviceRequest.findUnique({ where: { id: ticketId } });
      if (ticket) {
        const platformUrlSetting = await this.prisma.systemSetting.findUnique({
          where: { key: 'PLATFORM_URL' }
        });
        const frontendUrl = (platformUrlSetting?.value as string) || process.env.FRONTEND_URL || 'https://yato.honet.web.id';
        const ticketUrl = `${frontendUrl}/tickets?id=${ticket.id}&type=SERVICE`;
        await this.notificationService.sendToUserQueue(
          userId,
          `Follower Added: ${ticket.ticketId}`,
          `You have been added as a follower to service request <b>${ticket.ticketId}</b> for service <b>${ticket.serviceName}</b>.\n\nLink: ${ticketUrl}`,
        );
      }
    } catch (err) {
      // Safe catch
    }

    return this.prisma.serviceRequest.update({
      where: { id: ticketId },
      data: { followers: { connect: { id: userId } } }
    });
  }

  async removeFollower(ticketId: string, userId: string) {
    return this.prisma.serviceRequest.update({
      where: { id: ticketId },
      data: { followers: { disconnect: { id: userId } } }
    });
  }

  async findOne(id: string) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id },
      include: { user: true, followers: true }
    });
    if (!request) throw new NotFoundException('Service request not found');
    return request;
  }

  async approve(id: string, adminId: string, dto?: ApproveServiceRequestDto) {
    const request = await this.findOne(id);
    const updated = await this.prisma.serviceRequest.update({
      where: { id },
      data: { 
        status: 'APPROVED',
        approvedBy: adminId,
        approvedAt: new Date(),
      },
    });

    // Check if automated provisioning is enabled
    const isAutoEnabled = false;

    // Create Inventory Entry
    await this.prisma.serviceInventory.create({
      data: {
        requestId: id,
        address: dto?.address,
        port: dto?.port,
        username: dto?.username,
        password: dto?.password,
        status: dto?.address ? 'COMPLETED' : (isAutoEnabled ? 'PROVISIONING' : 'AWAITING_CONFIG')
      }
    });

    await this.auditService.log(adminId, 'APPROVE_SERVICE_REQUEST', 'ServiceRequest', id, {
      ticketId: request.ticketId,
      ...dto
    });

    // Add automatic comment
    await this.prisma.ticketComment.create({
      data: {
        content: `Service request has been APPROVED ${isAutoEnabled ? 'and is now being PROVISIONED' : (dto?.address ? `manually (Address: ${dto.address}:${dto.port})` : 'but requires manual configuration')}.`,
        serviceRequestId: id,
        authorId: adminId,
      }
    });

    // Notify requester
    const platformUrlSetting = await this.prisma.systemSetting.findUnique({
      where: { key: 'PLATFORM_URL' }
    });
    const frontendUrl = (platformUrlSetting?.value as string) || process.env.FRONTEND_URL || 'https://yato.honet.web.id';
    const ticketUrl = `${frontendUrl}/tickets?id=${id}&type=SERVICE`;
    try {
      await this.notificationService.sendToUserQueue(
        request.requestedBy,
        `Service Request Approved: ${request.ticketId}`,
        `Your request <b>${request.ticketId}</b> for service <b>${request.serviceName}</b> has been approved.\n\nLink: ${ticketUrl}`,
        `/tickets?id=${id}&type=SERVICE`
      );
    } catch (err) {
      // Safe catch
    }

    return updated;
  }

  async reject(id: string, adminId: string, reason: string) {
    const request = await this.findOne(id);
    const updated = await this.prisma.serviceRequest.update({
      where: { id },
      data: { 
        status: 'REJECTED',
        rejectionReason: reason
      },
    });

    await this.auditService.log(adminId, 'REJECT_SERVICE_REQUEST', 'ServiceRequest', id, {
      ticketId: request.ticketId,
      reason,
    });

    // Add automatic comment
    await this.prisma.ticketComment.create({
      data: {
        content: `Service request has been REJECTED. Reason: ${reason}`,
        serviceRequestId: id,
        authorId: adminId,
      }
    });

    // Notify requester
    const platformUrlSetting = await this.prisma.systemSetting.findUnique({
      where: { key: 'PLATFORM_URL' }
    });
    const frontendUrl = (platformUrlSetting?.value as string) || process.env.FRONTEND_URL || 'https://yato.honet.web.id';
    const ticketUrl = `${frontendUrl}/tickets?id=${id}&type=SERVICE`;
    try {
      await this.notificationService.sendToUserQueue(
        request.requestedBy,
        `Service Request Rejected: ${request.ticketId}`,
        `Your request <b>${request.ticketId}</b> for service <b>${request.serviceName}</b> was rejected: ${reason}\n\nLink: ${ticketUrl}`,
        `/tickets?id=${id}&type=SERVICE`
      );
    } catch (err) {
      // Safe catch
    }

    return updated;
  }

  async update(id: string, dto: any, userId: string) {
    const request = await this.findOne(id);
    const updated = await this.prisma.serviceRequest.update({
      where: { id },
      data: {
        serviceName: dto.serviceName,
        environment: dto.environment,
        version: dto.type || dto.version,
        config: dto.config || {},
        status: dto.status,
        attachments: dto.attachments,
      },
    });

    await this.auditService.log(userId, 'UPDATE_SERVICE_REQUEST', 'ServiceRequest', id, dto);
    return updated;
  }

  async deleteRequest(id: string, userId: string) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id },
      include: { followers: { select: { id: true } } },
    });
    if (!request) throw new NotFoundException('Service Request not found');

    // 1. Delete associated ServiceInventory if it exists
    await this.prisma.serviceInventory.deleteMany({
      where: { requestId: id },
    });

    // 2. Disconnect followers
    if (request.followers.length > 0) {
      await this.prisma.serviceRequest.update({
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

    // 3. Delete the Service Request (comments cascade-delete automatically via prisma)
    await this.prisma.serviceRequest.delete({
      where: { id },
    });

    // 4. Log deletion to audit activity
    await this.auditService.log(
      userId,
      'DELETE_SERVICE_REQUEST',
      'ServiceRequest',
      id,
      { ticketId: request.ticketId, serviceName: request.serviceName, environment: request.environment },
    );

    return { success: true, message: `Service Request ${request.ticketId} has been permanently deleted.` };
  }
}
