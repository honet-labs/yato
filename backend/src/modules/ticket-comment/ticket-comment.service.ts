import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class TicketCommentService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private storageService: StorageService,
  ) {}

  async create(data: { 
    content: string; 
    attachment?: string; 
    authorId: string; 
    vmRequestId?: string; 
    serviceRequestId?: string; 
    supportTicketId?: string;
    parentId?: string 
  }, user: any) {
    if (data.vmRequestId) {
      const vmReq = await this.prisma.vMRequest.findUnique({
        where: { id: data.vmRequestId },
        include: { followers: true }
      });
      if (!vmReq) throw new NotFoundException('Request not found');
      const isAdmin = user.roles?.some(r => r.role.name === 'ADMIN' || r.role.name === 'TICKETING_ADMIN');
      if (!isAdmin) {
        const isCreator = vmReq.requestedBy === user.id;
        const isFollower = vmReq.followers?.some(f => f.id === user.id);
        if (!isCreator && !isFollower) {
          throw new NotFoundException('Request not found');
        }
      }
    } else if (data.serviceRequestId) {
      const svcReq = await this.prisma.serviceRequest.findUnique({
        where: { id: data.serviceRequestId },
        include: { followers: true }
      });
      if (!svcReq) throw new NotFoundException('Request not found');
      const isAdmin = user.roles?.some(r => r.role.name === 'ADMIN' || r.role.name === 'TICKETING_ADMIN');
      if (!isAdmin) {
        const isCreator = svcReq.requestedBy === user.id;
        const isFollower = svcReq.followers?.some(f => f.id === user.id);
        if (!isCreator && !isFollower) {
          throw new NotFoundException('Request not found');
        }
      }
    } else if (data.supportTicketId) {
      const ticket = await this.prisma.supportTicket.findUnique({
        where: { id: data.supportTicketId },
        include: { followers: true }
      });
      if (!ticket) throw new NotFoundException('Ticket not found');
      const isAdmin = user.roles?.some(r => {
        const name = r.role.name.toUpperCase();
        return name === 'ADMIN' || name === 'TICKETING_ADMIN' || name === 'SYSTEM ADMIN' || name === 'SYSTEM_ADMIN' || name === 'SUPERADMIN';
      });
      if (!isAdmin) {
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
          throw new NotFoundException('Ticket not found');
        }
      }
    }

    let processedAttachment = data.attachment;
    if (data.attachment && data.attachment.startsWith('data:')) {
      const entityId = data.supportTicketId || data.vmRequestId || data.serviceRequestId || undefined;
      const files = await this.storageService.processAttachments(
        [data.attachment], 
        data.authorId, 
        entityId, 
        'COMMENT'
      );
      if (files.length > 0) {
        processedAttachment = files[0];
      }
    }

    const comment = await this.prisma.ticketComment.create({
      data: {
        content: data.content,
        attachment: processedAttachment,
        authorId: data.authorId,
        vmRequestId: data.vmRequestId,
        serviceRequestId: data.serviceRequestId,
        supportTicketId: data.supportTicketId,
        parentId: data.parentId,
      },
      include: { 
        author: { select: { fullName: true, username: true, roles: { include: { role: true } } } },
        replies: { include: { author: { select: { fullName: true, username: true, roles: { include: { role: true } } } } } }
      }
    });

    // Notify ticket owner and followers
    try {
      let ticketOwnerId: string | undefined;
      let ticketIdLabel: string | undefined;
      let followers: { id: string }[] = [];
      let ticketType = '';
      let ticketId = '';

      if (data.vmRequestId) {
        const t = await this.prisma.vMRequest.findUnique({ where: { id: data.vmRequestId }, include: { followers: true } });
        ticketOwnerId = t?.requestedBy;
        ticketIdLabel = t?.ticketId;
        followers = t?.followers || [];
        ticketType = 'VM';
        ticketId = data.vmRequestId;
      } else if (data.serviceRequestId) {
        const t = await this.prisma.serviceRequest.findUnique({ where: { id: data.serviceRequestId }, include: { followers: true } });
        ticketOwnerId = t?.requestedBy;
        ticketIdLabel = t?.ticketId;
        followers = t?.followers || [];
        ticketType = 'SERVICE';
        ticketId = data.serviceRequestId;
      } else if (data.supportTicketId) {
        const t = await this.prisma.supportTicket.findUnique({ where: { id: data.supportTicketId }, include: { followers: true } });
        ticketOwnerId = t?.requestedBy;
        ticketIdLabel = t?.ticketId;
        followers = t?.followers || [];
        ticketType = 'SUPPORT';
        ticketId = data.supportTicketId;
      }

      const platformUrlSetting = await this.prisma.systemSetting.findUnique({
        where: { key: 'PLATFORM_URL' }
      });
      const frontendUrl = (platformUrlSetting?.value as string) || process.env.FRONTEND_URL || 'https://yato.honet.web.id';
      const ticketUrl = `${frontendUrl}/tickets?id=${ticketId}&type=${ticketType}`;

      const notifyIds = new Set([...followers.map(f => f.id), ticketOwnerId].filter(id => id && id !== data.authorId));
      const mentionedUserIds = new Set<string>();

      // Mention Detection Logic
      const mentionRegex = /@([^\s,.:;!?"'()\[\]{}]+)/g;
      const matches = [...data.content.matchAll(mentionRegex)];
      if (matches.length > 0) {
        const usernames = matches.map(m => m[1].toLowerCase());
        const allUsers = await this.prisma.user.findMany({
          select: { id: true, username: true, fullName: true }
        });
        const mentionedUsers = allUsers.filter(u => {
          const normUsername = u.username ? u.username.toLowerCase() : '';
          const normFullName = u.fullName ? u.fullName.replace(/\s+/g, '').toLowerCase() : '';
          return usernames.some(uname => uname === normUsername || uname === normFullName);
        });

        for (const user of mentionedUsers) {
          if (user.id !== data.authorId) {
            mentionedUserIds.add(user.id);
            // Send specific mention notification via BullMQ
            await this.notificationService.sendToUserQueue(
              user.id,
              'You were mentioned',
              `<b>${comment.author.fullName}</b> mentioned you in a comment on ticket <b>${ticketIdLabel}</b>: "${data.content}"\n\nLink: ${ticketUrl}`,
            );
          }
        }
      }

      // Notify other followers / owner who were not mentioned
      for (const uid of notifyIds) {
        if (uid && !mentionedUserIds.has(uid)) {
          await this.notificationService.sendToUserQueue(
            uid,
            `New Comment on Ticket: ${ticketIdLabel}`,
            `<b>${comment.author.fullName}</b> commented on ticket <b>${ticketIdLabel}</b>: "${data.content}"\n\nLink: ${ticketUrl}`,
          );
        }
      }
    } catch (e) {
      console.error('Failed to send comment/mention notification', e);
    }

    return comment;
  }

  async findByTicket(id: string, type: 'VM' | 'SERVICE' | 'SUPPORT', user: any) {
    if (type === 'VM') {
      const vmReq = await this.prisma.vMRequest.findUnique({
        where: { id },
        include: { followers: true }
      });
      if (!vmReq) throw new NotFoundException('Request not found');
      const isAdmin = user.roles?.some(r => r.role.name === 'ADMIN' || r.role.name === 'TICKETING_ADMIN');
      if (!isAdmin) {
        const isCreator = vmReq.requestedBy === user.id;
        const isFollower = vmReq.followers?.some(f => f.id === user.id);
        if (!isCreator && !isFollower) {
          throw new NotFoundException('Request not found');
        }
      }
    } else if (type === 'SERVICE') {
      const svcReq = await this.prisma.serviceRequest.findUnique({
        where: { id },
        include: { followers: true }
      });
      if (!svcReq) throw new NotFoundException('Request not found');
      const isAdmin = user.roles?.some(r => r.role.name === 'ADMIN' || r.role.name === 'TICKETING_ADMIN');
      if (!isAdmin) {
        const isCreator = svcReq.requestedBy === user.id;
        const isFollower = svcReq.followers?.some(f => f.id === user.id);
        if (!isCreator && !isFollower) {
          throw new NotFoundException('Request not found');
        }
      }
    } else if (type === 'SUPPORT') {
      const ticket = await this.prisma.supportTicket.findUnique({
        where: { id },
        include: { followers: true }
      });
      if (!ticket) throw new NotFoundException('Ticket not found');
      const isAdmin = user.roles?.some(r => {
        const name = r.role.name.toUpperCase();
        return name === 'ADMIN' || name === 'TICKETING_ADMIN' || name === 'SYSTEM ADMIN' || name === 'SYSTEM_ADMIN' || name === 'SUPERADMIN';
      });
      if (!isAdmin) {
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
          throw new NotFoundException('Ticket not found');
        }
      }
    }

    const allComments = await this.prisma.ticketComment.findMany({
      where: {
        ...(type === 'VM' ? { vmRequestId: id } : 
           type === 'SERVICE' ? { serviceRequestId: id } : 
           { supportTicketId: id }),
      },
      include: { 
        author: { select: { fullName: true, username: true, roles: { include: { role: true } } } }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Build tree
    const commentMap = new Map();
    const tree: any[] = [];

    allComments.forEach(comment => {
      commentMap.set(comment.id, { ...comment, replies: [] });
    });

    allComments.forEach(comment => {
      const commentWithReplies = commentMap.get(comment.id);
      if (comment.parentId && commentMap.has(comment.parentId)) {
        commentMap.get(comment.parentId).replies.push(commentWithReplies);
      } else if (!comment.parentId) {
        tree.push(commentWithReplies);
      }
    });

    return tree;
  }

  async update(commentId: string, data: { content: string; attachment?: string }, userId: string) {
    const comment = await this.prisma.ticketComment.findUnique({
      where: { id: commentId },
    });
    if (!comment) {
      throw new Error('Comment not found');
    }
    if (comment.authorId !== userId) {
      throw new Error('Unauthorized to edit this comment');
    }

    let processedAttachment = data.attachment;
    if (data.attachment && data.attachment.startsWith('data:')) {
      const entityId = comment.supportTicketId || comment.vmRequestId || comment.serviceRequestId || undefined;
      const files = await this.storageService.processAttachments(
        [data.attachment],
        userId,
        entityId,
        'COMMENT'
      );
      if (files.length > 0) {
        processedAttachment = files[0];
      }
    }

    return this.prisma.ticketComment.update({
      where: { id: commentId },
      data: {
        content: data.content,
        attachment: processedAttachment,
      },
      include: {
        author: { select: { fullName: true, username: true, roles: { include: { role: true } } } }
      }
    });
  }
}

