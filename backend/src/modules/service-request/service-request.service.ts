import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';
import { EncryptionService } from '../../common/utils/encryption.service';
import { ApproveServiceRequestDto, CreateServiceRequestDto } from './dto/service-request.dto';

@Injectable()
export class ServiceRequestService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private notificationService: NotificationService,
    private encryptionService: EncryptionService,
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
        category: (dto as any).category || null,
        tags: (dto as any).tags || [],
        config: dto.config || {},
        requestedBy: userId,
        status: 'PENDING',
        endpoint: dto.endpoint,
        address: dto.address,
        port: dto.port ? parseInt(dto.port as any) : undefined,
        username: dto.username,
        password: dto.password ? this.encryptionService.encrypt(dto.password) : undefined,
      },
    });

    const frontendUrl = await this.notificationService.getFrontendUrl();
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
    const userRoles = user?.roles?.map((ur: any) => ur.role?.name?.toUpperCase()) || [];
    const isAdmin = userRoles.some((role: string) => 
      ['ADMIN', 'TICKETING_ADMIN', 'SYSTEM ADMIN', 'SYSTEM_ADMIN', 'SUPERADMIN'].includes(role)
    );
    
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

  async addFollower(ticketId: string, followerUserId: string, user: any) {
    await this.findOne(ticketId, user);
    try {
      const ticket = await this.prisma.serviceRequest.findUnique({ where: { id: ticketId } });
      if (ticket) {
        const frontendUrl = await this.notificationService.getFrontendUrl();
        const ticketUrl = `${frontendUrl}/tickets?id=${ticket.id}&type=SERVICE`;
        await this.notificationService.sendToUserQueue(
          followerUserId,
          `Follower Added: ${ticket.ticketId}`,
          `You have been added as a follower to service request <b>${ticket.ticketId}</b> for service <b>${ticket.serviceName}</b>.\n\nLink: ${ticketUrl}`,
        );
      }
    } catch (err) {
      // Safe catch
    }

    return this.prisma.serviceRequest.update({
      where: { id: ticketId },
      data: { followers: { connect: { id: followerUserId } } }
    });
  }

  async removeFollower(ticketId: string, followerUserId: string, user: any) {
    await this.findOne(ticketId, user);
    return this.prisma.serviceRequest.update({
      where: { id: ticketId },
      data: { followers: { disconnect: { id: followerUserId } } }
    });
  }

  async findOne(id: string, user?: any) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id },
      include: { user: true, followers: true }
    });
    if (!request) throw new NotFoundException('Service request not found');

    // Enforce visibility: only admin, creator, or followers can view
    if (user) {
      const userRoles = user?.roles?.map((ur: any) => ur.role?.name?.toUpperCase()) || [];
      const isAdmin = userRoles.some((role: string) => 
        ['ADMIN', 'TICKETING_ADMIN', 'SYSTEM ADMIN', 'SYSTEM_ADMIN', 'SUPERADMIN'].includes(role)
      );
      if (!isAdmin) {
        const isCreator = request.requestedBy === user.id;
        const isFollower = request.followers?.some(f => f.id === user.id);
        if (!isCreator && !isFollower) {
          throw new NotFoundException('Service request not found');
        }
      }
    }

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
    const autoProv = await this.prisma.systemSetting.findUnique({ 
      where: { key: 'AUTOMATED_PROVISIONING_ENABLED' } 
    });
    
    const isAutoEnabled = autoProv 
      ? (typeof autoProv.value === 'object' && autoProv.value !== null && 'enabled' in (autoProv.value as any))
        ? (autoProv.value as any).enabled
        : !!autoProv.value
      : true;

    const address = dto?.address || request.address;
    const port = dto?.port ? parseInt(dto.port as any) : (request.port || null);
    const username = dto?.username || request.username;
    const endpoint = request.endpoint;

    let finalPassword = null;
    if (dto?.password && dto.password !== '••••••••' && dto.password !== '••••••••••••' && dto.password !== '********' && dto.password !== '****************') {
      finalPassword = this.encryptionService.encrypt(dto.password);
    } else if (request.password) {
      finalPassword = request.password;
    }

    // Create Inventory Entry
    await this.prisma.serviceInventory.create({
      data: {
        requestId: id,
        endpoint: endpoint || null,
        address: address || null,
        port: port,
        username: username || null,
        password: finalPassword,
        status: address ? 'COMPLETED' : (isAutoEnabled ? 'PROVISIONING' : 'AWAITING_CONFIG')
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
    const frontendUrl = await this.notificationService.getFrontendUrl();
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
    const frontendUrl = await this.notificationService.getFrontendUrl();
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

  async update(id: string, dto: any, user: any) {
    const request = await this.findOne(id, user);

    // Ensure only admin or creator can update it
    const userRoles = user?.roles?.map((ur: any) => ur.role?.name?.toUpperCase()) || [];
    const isAdmin = userRoles.some((role: string) => 
      ['ADMIN', 'TICKETING_ADMIN', 'SYSTEM ADMIN', 'SYSTEM_ADMIN', 'SUPERADMIN'].includes(role)
    );
    const isCreator = request.requestedBy === user.id;
    if (!isAdmin && !isCreator) {
      throw new NotFoundException('Request not found');
    }

    if (dto.status === 'APPROVED' && request.status === 'PENDING') {
      return this.approve(id, user.id, dto);
    }
    if (dto.status === 'REJECTED' && request.status === 'PENDING') {
      return this.reject(id, user.id, dto.rejectionReason || 'Status updated to REJECTED via edit');
    }

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

    await this.auditService.log(user.id, 'UPDATE_SERVICE_REQUEST', 'ServiceRequest', id, dto);
    return updated;
  }

  async deleteRequest(id: string, userId: string) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id },
      include: { followers: { select: { id: true } } },
    });
    if (!request) throw new NotFoundException('Service Request not found');

    // 1. Soft delete associated ServiceInventory
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

    // 3. Soft delete the Service Request
    await this.prisma.serviceRequest.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // 4. Log deletion to audit activity
    await this.auditService.log(
      userId,
      'DELETE_SERVICE_REQUEST',
      'ServiceRequest',
      id,
      { ticketId: request.ticketId, serviceName: request.serviceName, environment: request.environment },
    );

    return { success: true, message: `Service Request ${request.ticketId} has been soft deleted.` };
  }
}
