import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupportTicketDto } from './dto/support-ticket.dto';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class SupportTicketService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private notificationService: NotificationService,
    private storageService: StorageService,
  ) {}

  private async generateTicketId() {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    const startOfDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59, 999));

    const count = await this.prisma.supportTicket.count({
      where: {
        createdAt: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
    });
    const sequence = (count + 1).toString().padStart(4, '0');
    return `SUP-${dateStr}-${sequence}`;
  }

  async create(dto: CreateSupportTicketDto, userId: string) {
    const ticketId = await this.generateTicketId();
    
    // Process attachments through dynamic storage strategy
    const processedAttachments = await this.storageService.processAttachments(
      dto.attachments || [],
      userId,
      ticketId,
      'SUPPORT_TICKET',
    );

    const ticket = await this.prisma.supportTicket.create({
      data: {
        ticketId,
        subject: dto.subject,
        description: dto.description,
        category: dto.category || 'GENERAL',
        tags: dto.tags || [],
        attachments: processedAttachments,
        priority: dto.priority || 'NORMAL',
        requestedBy: userId,
      },
    });

    const platformUrlSetting = await this.prisma.systemSetting.findUnique({
      where: { key: 'PLATFORM_URL' }
    });
    const frontendUrl = (platformUrlSetting?.value as string) || process.env.FRONTEND_URL || 'https://yato.honet.web.id';
    const ticketUrl = `${frontendUrl}/tickets?id=${ticket.id}&type=SUPPORT`;

    // Notify requester via BullMQ queue
    try {
      await this.notificationService.sendToUserQueue(
        userId,
        `Support Ticket Created: ${ticketId}`,
        `Your support ticket <b>${ticketId}</b> (${dto.priority || 'NORMAL'} priority) has been successfully created. Subject: ${dto.subject}\n\nLink: ${ticketUrl}`,
      );
    } catch (err) {
      this.prisma.supportTicket.count(); // Avoid typescript warning, log error
    }

    // Notify routed admins based on dynamic notification rules
    try {
      const recipients = await this.notificationService.getRecipientsForTicket({
        type: 'SUPPORT',
        category: dto.category || 'GENERAL',
        priority: dto.priority || 'NORMAL',
        excludeUserId: userId
      });
      const requester = await this.prisma.user.findUnique({ where: { id: userId } });
      const requesterName = requester?.fullName || 'A user';

      for (const recipient of recipients) {
        await this.notificationService.sendToUserQueue(
          recipient.id,
          `New Support Ticket: ${ticketId}`,
          `A new ticket <b>${ticketId}</b> with <b>${dto.priority || 'NORMAL'}</b> priority [Category: <b>${dto.category || 'GENERAL'}</b>] has been submitted by <b>${requesterName}</b>.\nSubject: ${dto.subject}\n\nLink: ${ticketUrl}`,
        );
      }
    } catch (err) {
      // Safe catch
    }

    await this.auditService.log(userId, 'CREATE_SUPPORT_TICKET', 'SupportTicket', ticket.id, { ticketId });
    return ticket;
  }

  async findAll(user: any) {
    const userTagIdentifiers = [
      user.username,
      user.fullName,
      user.username ? `@${user.username}` : null,
      user.fullName ? `@${user.fullName.replace(/\s+/g, '')}` : null
    ].filter(Boolean) as string[];

    const where = {
      OR: [
        { requestedBy: user.id },
        { followers: { some: { id: user.id } } },
        { tags: { hasSome: userTagIdentifiers } }
      ]
    };

    return this.prisma.supportTicket.findMany({
      where,
      include: { 
        user: { select: { fullName: true, email: true } },
        followers: { select: { id: true, fullName: true } },
        comments: { select: { id: true, authorId: true, createdAt: true } }
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, user: any) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: { 
        user: { select: { id: true, fullName: true, email: true, username: true } },
        followers: { select: { id: true, fullName: true, username: true } },
        comments: {
          include: { author: { select: { fullName: true, username: true } } },
          orderBy: { createdAt: 'asc' }
        }
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const isCreator = ticket.requestedBy === user.id;
    const isFollower = ticket.followers.some(f => f.id === user.id);
    const isTagged = ticket.tags?.some(t => {
      const cleanTag = t.toLowerCase();
      const uName = user.username?.toLowerCase();
      const fName = user.fullName?.toLowerCase();
      const cleanFName = user.fullName?.replace(/\s+/g, '').toLowerCase();
      return cleanTag === uName || cleanTag === `@${uName}` || cleanTag === fName || cleanTag === `@${cleanFName}`;
    });

    if (!isCreator && !isFollower && !isTagged) {
      await this.auditService.log(user.id, 'UNAUTHORIZED_ACCESS_ATTEMPT', 'SupportTicket', id, {
        reason: 'User is not Creator, Follower or Tagged',
        user: { id: user.id, username: user.username, email: user.email }
      });
      throw new NotFoundException('Ticket not found');
    }

    return ticket;
  }

  async updateStatus(id: string, status: string, user: any) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id }
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const isCreator = ticket.requestedBy === user.id;
    const isFollower = ticket.followers.some(f => f.id === user.id);
    const isTagged = ticket.tags?.some(t => {
      const cleanTag = t.toLowerCase();
      const uName = user.username?.toLowerCase();
      const fName = user.fullName?.toLowerCase();
      const cleanFName = user.fullName?.replace(/\s+/g, '').toLowerCase();
      return cleanTag === uName || cleanTag === `@${uName}` || cleanTag === fName || cleanTag === `@${cleanFName}`;
    });

    if (!isCreator && !isFollower && !isTagged) {
      await this.auditService.log(user.id, 'UNAUTHORIZED_ACCESS_ATTEMPT', 'SupportTicket', id, {
        reason: 'User is not Creator, Follower or Tagged to update status of SupportTicket',
        user: { id: user.id, username: user.username, email: user.email }
      });
      throw new NotFoundException('Ticket not found');
    }

    const updatedTicket = await this.prisma.supportTicket.update({
      where: { id },
      data: { status },
    });
    await this.auditService.log(user.id, 'UPDATE_SUPPORT_TICKET_STATUS', 'SupportTicket', id, { status });

    // Add automatic comment to conversation thread
    await this.prisma.ticketComment.create({
      data: {
        content: `Ticket status has been updated to ${status}.`,
        supportTicketId: id,
        authorId: user.id,
      }
    });
    // Notify requester
    const platformUrlSetting = await this.prisma.systemSetting.findUnique({
      where: { key: 'PLATFORM_URL' }
    });
    const frontendUrl = (platformUrlSetting?.value as string) || process.env.FRONTEND_URL || 'https://yato.honet.web.id';
    const ticketUrl = `${frontendUrl}/tickets?id=${id}&type=SUPPORT`;
    try {
      await this.notificationService.sendToUserQueue(
        updatedTicket.requestedBy,
        `Support Ticket Updated: ${updatedTicket.ticketId}`,
        `Your ticket <b>${updatedTicket.ticketId}</b> status has been changed to ${status}.\n\nLink: ${ticketUrl}`,
        `/tickets?id=${id}&type=SUPPORT`
      );
    } catch (err) {
      // Safe catch
    }
    return updatedTicket;
  }

  async addFollower(id: string, followerUserId: string, user: any) {
    const ticket = await this.prisma.supportTicket.findUnique({ 
      where: { id },
      include: { followers: { select: { id: true } } }
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const isCreator = ticket.requestedBy === user.id;
    const isFollower = ticket.followers.some(f => f.id === user.id);
    const isTagged = ticket.tags?.some(t => {
      const cleanTag = t.toLowerCase();
      const uName = user.username?.toLowerCase();
      const fName = user.fullName?.toLowerCase();
      const cleanFName = user.fullName?.replace(/\s+/g, '').toLowerCase();
      return cleanTag === uName || cleanTag === `@${uName}` || cleanTag === fName || cleanTag === `@${cleanFName}`;
    });

    if (!isCreator && !isFollower && !isTagged) {
      await this.auditService.log(user.id, 'UNAUTHORIZED_ACCESS_ATTEMPT', 'SupportTicket', id, {
        reason: 'User is not Creator, Follower, or Tagged to add a follower',
        user: { id: user.id, username: user.username, email: user.email }
      });
      throw new NotFoundException('Ticket not found');
    }

    try {
      const platformUrlSetting = await this.prisma.systemSetting.findUnique({
        where: { key: 'PLATFORM_URL' }
      });
      const frontendUrl = (platformUrlSetting?.value as string) || process.env.FRONTEND_URL || 'https://yato.honet.web.id';
      const ticketUrl = `${frontendUrl}/tickets?id=${ticket.id}&type=SUPPORT`;
      await this.notificationService.sendToUserQueue(
        followerUserId,
        `Follower Added: ${ticket.ticketId}`,
        `You have been added as a follower to support ticket <b>${ticket.ticketId}</b>: "${ticket.subject}".\n\nLink: ${ticketUrl}`,
      );
    } catch (err) {
      // Safe catch
    }

    return this.prisma.supportTicket.update({
      where: { id },
      data: { followers: { connect: { id: followerUserId } } }
    });
  }

  async removeFollower(id: string, followerUserId: string, user: any) {
    const ticket = await this.prisma.supportTicket.findUnique({ 
      where: { id },
      include: { followers: { select: { id: true } } }
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const isCreator = ticket.requestedBy === user.id;
    const isFollower = ticket.followers.some(f => f.id === user.id);
    const isTagged = ticket.tags?.some(t => {
      const cleanTag = t.toLowerCase();
      const uName = user.username?.toLowerCase();
      const fName = user.fullName?.toLowerCase();
      const cleanFName = user.fullName?.replace(/\s+/g, '').toLowerCase();
      return cleanTag === uName || cleanTag === `@${uName}` || cleanTag === fName || cleanTag === `@${cleanFName}`;
    });

    if (!isCreator && !isFollower && !isTagged) {
      await this.auditService.log(user.id, 'UNAUTHORIZED_ACCESS_ATTEMPT', 'SupportTicket', id, {
        reason: 'User is not Creator, Follower, or Tagged to remove a follower',
        user: { id: user.id, username: user.username, email: user.email }
      });
      throw new NotFoundException('Ticket not found');
    }

    return this.prisma.supportTicket.update({
      where: { id },
      data: { followers: { disconnect: { id: followerUserId } } }
    });
  }

  async update(id: string, dto: any, user: any) {
    const ticket = await this.prisma.supportTicket.findUnique({ 
      where: { id },
      include: { followers: { select: { id: true } } }
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const isCreator = ticket.requestedBy === user.id;
    const isFollower = ticket.followers.some(f => f.id === user.id);
    const isTagged = ticket.tags?.some(t => {
      const cleanTag = t.toLowerCase();
      const uName = user.username?.toLowerCase();
      const fName = user.fullName?.toLowerCase();
      const cleanFName = user.fullName?.replace(/\s+/g, '').toLowerCase();
      return cleanTag === uName || cleanTag === `@${uName}` || cleanTag === fName || cleanTag === `@${cleanFName}`;
    });

    if (!isCreator && !isFollower && !isTagged) {
      await this.auditService.log(user.id, 'UNAUTHORIZED_ACCESS_ATTEMPT', 'SupportTicket', id, {
        reason: 'User is not Creator, Follower or Tagged to update SupportTicket',
        user: { id: user.id, username: user.username, email: user.email }
      });
      throw new NotFoundException('Ticket not found');
    }

    let processedAttachments = dto.attachments;
    if (dto.attachments) {
      processedAttachments = await this.storageService.processAttachments(
        dto.attachments,
        user.id,
        ticket.ticketId,
        'SUPPORT_TICKET',
      );
    }

    const updated = await this.prisma.supportTicket.update({
      where: { id },
      data: {
        subject: dto.subject,
        description: dto.description,
        priority: dto.priority,
        category: dto.category,
        status: dto.status,
        tags: dto.tags,
        attachments: processedAttachments,
      },
    });

    await this.auditService.log(user.id, 'UPDATE_SUPPORT_TICKET', 'SupportTicket', id, dto);
    return updated;
  }

  async getUniqueTags() {
    const tickets = await this.prisma.supportTicket.findMany({
      select: { tags: true }
    });
    const allTags = tickets.flatMap(t => t.tags || []);
    return Array.from(new Set(allTags)).sort();
  }

  async deleteTicket(id: string, userId: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: { followers: { select: { id: true } } },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    // Delete all related comments first
    await this.prisma.ticketComment.deleteMany({
      where: { supportTicketId: id },
    });

    // Disconnect all followers
    if (ticket.followers.length > 0) {
      await this.prisma.supportTicket.update({
        where: { id },
        data: {
          followers: {
            disconnect: ticket.followers.map(f => ({ id: f.id })),
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

    // Delete the ticket
    await this.prisma.supportTicket.delete({ where: { id } });

    // Log the deletion to audit trail
    await this.auditService.log(
      userId,
      'DELETE_SUPPORT_TICKET',
      'SupportTicket',
      id,
      { ticketId: ticket.ticketId, subject: ticket.subject, category: ticket.category, priority: ticket.priority },
    );

    return { success: true, message: `Ticket ${ticket.ticketId} has been permanently deleted.` };
  }
}

