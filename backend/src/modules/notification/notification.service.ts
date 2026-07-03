import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';
import * as nodemailer from 'nodemailer';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private emailTransporter: nodemailer.Transporter | null = null;
  private platformUrlCache: string | null = null;
  private platformUrlCacheTime: number = 0;

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  private async getEmailTransporter(config?: any): Promise<nodemailer.Transporter> {
    const emailConfig = config || await this.getSetting('EMAIL_CONFIG');
    if (!emailConfig) throw new Error('Email configuration not found');

    if (!this.emailTransporter || config) {
      this.emailTransporter = nodemailer.createTransport({
        host: emailConfig.host,
        port: parseInt(emailConfig.port),
        secure: emailConfig.security === 'SSL',
        auth: {
          user: emailConfig.user,
          pass: emailConfig.pass,
        },
        tls: {
          rejectUnauthorized: process.env.NODE_ENV !== 'development'
        },
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
      });
    }

    return this.emailTransporter;
  }

  async create(userId: string, title: string, message: string, type: string, link?: string) {
    return this.prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        link,
      },
    });
  }

  async createNotification(userId: string, type: string, title: string, message: string) {
    let extractedLink = undefined;
    if (message) {
      const linkMatch = message.match(/Link:\s*(https?:\/\/[^\s<]+|\/[^\s<]+)/i);
      if (linkMatch && linkMatch[1]) {
        extractedLink = linkMatch[1];
      }
    }
    return this.create(userId, title, message, type, extractedLink);
  }

  async checkUserPreference(userId: string, type: string): Promise<boolean> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          emailNotificationEnabled: true,
          whatsappNotificationEnabled: true,
          telegramNotificationEnabled: true,
        }
      });
      if (!user) return true;
      if (type === 'EMAIL') return user.emailNotificationEnabled;
      if (type === 'WHATSAPP') return user.whatsappNotificationEnabled;
      if (type === 'TELEGRAM') return user.telegramNotificationEnabled;
      return true;
    } catch (e) {
      this.logger.error(`Error checking user preference: ${e.message}`);
      return true;
    }
  }

  async findAll(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    
    const [data, totalCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);

    return {
      data,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    };
  }

  async markAsRead(id: string, userId?: string) {
    const where: any = { id };
    if (userId) where.userId = userId;
    return this.prisma.notification.update({
      where,
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async sendEmail(to: string, subject: string, text: string, config?: any) {
    try {
      const transporter = await this.getEmailTransporter(config);

      await transporter.sendMail({
        from: `"YATO" <${config?.user || (await this.getSetting('EMAIL_CONFIG') as any)?.user}>`,
        to,
        subject,
        text,
      });

      return { success: true, message: 'Email sent successfully' };
    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message}`);
      return { success: false, message: error.message };
    }
  }

  async sendWhatsApp(to: string, message: string, config?: any) {
    try {
      const waConfig = config || await this.getSetting('WHATSAPP_CONFIG');
      if (!waConfig) throw new Error('WhatsApp configuration not found');

      let cleanPhone = to.replace(/\D/g, '');
      if (cleanPhone.startsWith('0')) {
        cleanPhone = '62' + cleanPhone.substring(1);
      }

      await axios.post(`${waConfig.url}/api/sendText`, {
        session: waConfig.session || 'default',
        chatId: `${cleanPhone}@c.us`,
        text: message,
      }, {
        headers: { 'X-Api-Key': waConfig.apiKey }
      });

      return { success: true, message: 'WhatsApp message sent' };
    } catch (error) {
      this.logger.error(`Failed to send WhatsApp: ${error.message}`);
      return { success: false, message: error.message };
    }
  }

  async sendTelegram(chatId: string, message: string, config?: any) {
    try {
      const tgConfig = config || await this.getSetting('TELEGRAM_CONFIG');
      if (!tgConfig) throw new Error('Telegram configuration not found');

      const botToken = tgConfig.botToken;
      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

      const sanitizeHtmlForTelegram = (html: string): string => {
        if (!html) return '';
        let processed = html;
        
        const tagsToProtect = [
          { regex: /<b>/gi, token: '___B_OPEN___' },
          { regex: /<\/b>/gi, token: '___B_CLOSE___' },
          { regex: /<strong>/gi, token: '___STRONG_OPEN___' },
          { regex: /<\/strong>/gi, token: '___STRONG_CLOSE___' },
          { regex: /<i>/gi, token: '___I_OPEN___' },
          { regex: /<\/i>/gi, token: '___I_CLOSE___' },
          { regex: /<em>/gi, token: '___EM_OPEN___' },
          { regex: /<\/em>/gi, token: '___EM_CLOSE___' },
        ];

        const aTagRegex = /<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>(.*?)<\/a>/gi;
        const aTagMatches: { token: string, href: string, text: string }[] = [];
        processed = processed.replace(aTagRegex, (match, href, text) => {
          const token = `___A_TAG_${aTagMatches.length}___`;
          aTagMatches.push({ token, href, text });
          return token;
        });

        for (const tag of tagsToProtect) {
          processed = processed.replace(tag.regex, tag.token);
        }

        processed = processed
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');

        for (const tag of tagsToProtect) {
          processed = processed.split(tag.token).join(tag.regex.source.replace(/\\/g, ''));
        }

        for (const match of aTagMatches) {
          const escapedHref = match.href.replace(/&/g, '&amp;');
          processed = processed.split(match.token).join(`<a href="${escapedHref}">${match.text}</a>`);
        }

        return processed;
      };

      const sanitizedMessage = sanitizeHtmlForTelegram(message);

      await axios.post(url, {
        chat_id: chatId,
        text: sanitizedMessage,
        parse_mode: 'HTML'
      });

      return { success: true, message: 'Telegram message sent' };
    } catch (error) {
      const errorMsg = error.response?.data?.description || error.message;
      this.logger.error(`Failed to send Telegram: ${errorMsg}`);
      return { success: false, message: errorMsg };
    }
  }

  async isUserOnLeave(userId: string): Promise<boolean> {
    try {
      const now = new Date();
      const leave = await this.prisma.leaveRequest.findFirst({
        where: {
          userId,
          status: 'APPROVED',
          startDate: { lte: now },
          endDate: { gte: now },
        },
      });
      return !!leave;
    } catch (e) {
      this.logger.error(`Error checking user leave status: ${e.message}`);
      return false;
    }
  }

  async sendToUser(userId: string, title: string, message: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;

    const isOnLeave = await this.isUserOnLeave(userId);
    if (isOnLeave) {
      this.logger.log(`User ${user.fullName} (${userId}) is currently ON LEAVE. Auto-snoozing external alerts.`);
    }

    const fullMessage = `<b>${title}</b>\n\n${message}`;

    if (user.telegramId && !isOnLeave) {
      await this.sendTelegram(user.telegramId, fullMessage);
    }

    if (user.phoneNumber && !isOnLeave) {
      await this.sendWhatsApp(user.phoneNumber, fullMessage);
    }

    if (user.email && !isOnLeave) {
      const plainMessage = message.replace(/<[^>]*>/g, '');
      await this.sendEmail(user.email, title, plainMessage);
    }

    let extractedLink = undefined;
    if (message) {
      const linkMatch = message.match(/Link:\s*(https?:\/\/[^\s<]+|\/[^\s<]+)/i);
      if (linkMatch && linkMatch[1]) {
        extractedLink = linkMatch[1];
      }
    }

    await this.create(userId, title, message, extractedLink ? 'TICKET_UPDATE' : 'INFO', extractedLink);
  }

  async sendToUserQueue(userId: string, title: string, message: string, link?: string, type?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      this.logger.error(`[sendToUserQueue] Failed to send notification: User with ID ${userId} not found.`);
      return;
    }

    const isOnLeave = await this.isUserOnLeave(userId);
    if (isOnLeave) {
      this.logger.log(`[sendToUserQueue] User ${user.fullName} (${userId}) is currently ON LEAVE.`);
    }

    const plainMessage = message.replace(/<[^>]*>/g, '');
    let queuedCount = 0;

    if (user.telegramId && !isOnLeave) {
      this.eventEmitter.emit('notification.trigger', {
        userId: user.id,
        type: 'TELEGRAM',
        title,
        message,
        recipient: user.telegramId
      });
      queuedCount++;
    }

    if (user.phoneNumber && !isOnLeave) {
      this.eventEmitter.emit('notification.trigger', {
        userId: user.id,
        type: 'WHATSAPP',
        title,
        message: plainMessage,
        recipient: user.phoneNumber
      });
      queuedCount++;
    }

    if (user.email && !isOnLeave) {
      this.eventEmitter.emit('notification.trigger', {
        userId: user.id,
        type: 'EMAIL',
        title,
        message: plainMessage,
        recipient: user.email
      });
      queuedCount++;
    }

    if (queuedCount === 0) {
      if (isOnLeave) {
        this.logger.log(`[sendToUserQueue] No channels queued for ${user.fullName} (${user.id}) - on leave.`);
      } else {
        this.logger.warn(`[sendToUserQueue] No channels configured for ${user.fullName} (${user.id}).`);
      }
    }

    let finalLink = link;
    if (!finalLink && message) {
      const linkMatch = message.match(/Link:\s*(https?:\/\/[^\s<]+|\/[^\s<]+)/i);
      if (linkMatch && linkMatch[1]) {
        finalLink = linkMatch[1];
      }
    }

    await this.create(userId, title, message, type || (finalLink ? 'TICKET_UPDATE' : 'INFO'), finalLink);
  }


  async getRecipientsForTicket(params: {
    type: 'SUPPORT' | 'VM' | 'SERVICE';
    category?: string;
    priority?: string;
    excludeUserId?: string;
  }): Promise<any[]> {
    const { type, category = 'GENERAL', priority = 'NORMAL', excludeUserId } = params;

    let rules: any[] = [];
    try {
      const rulesSetting = await this.prisma.systemSetting.findUnique({
        where: { key: 'NOTIFICATION_ROUTING_RULES' }
      });
      if (rulesSetting && rulesSetting.value) {
        rules = rulesSetting.value as any[];
      } else {
        rules = [
          {
            name: "Network Team Route",
            categories: ["NETWORK", "NETWORKING", "ROUTER", "SWITCH", "FIREWALL"],
            priorities: ["LOW", "NORMAL", "HIGH", "URGENT", "CRITICAL"],
            ticketTypes: ["SUPPORT", "SERVICE"],
            targetRoles: ["ADMIN_NETWORK", "NETWORK_ADMIN"]
          },
          {
            name: "Infra Team Route",
            categories: ["INFRASTRUCTURE", "HARDWARE", "SERVER", "VM"],
            priorities: ["LOW", "NORMAL", "HIGH", "URGENT", "CRITICAL"],
            ticketTypes: ["VM", "SERVICE", "SUPPORT"],
            targetRoles: ["ADMIN_INFRA", "INFRA_ADMIN"]
          },
          {
            name: "Database Team Route",
            categories: ["DATABASE", "DBA", "POSTGRESQL", "MYSQL", "REDIS"],
            priorities: ["LOW", "NORMAL", "HIGH", "URGENT", "CRITICAL"],
            ticketTypes: ["SUPPORT", "SERVICE"],
            targetRoles: ["ADMIN_DATABASE", "DBA_ADMIN"]
          }
        ];
        await this.prisma.systemSetting.upsert({
          where: { key: 'NOTIFICATION_ROUTING_RULES' },
          update: {},
          create: {
            key: 'NOTIFICATION_ROUTING_RULES',
            value: rules
          }
        });
      }
    } catch (e) {
      this.logger.error(`Error loading routing rules: ${e.message}`);
    }

    const upperCategory = category.toUpperCase();
    const upperPriority = priority.toUpperCase();

    const matchedRoles = new Set<string>();

    for (const rule of rules) {
      const ruleCategories = (rule.categories || []).map((c: string) => c.toUpperCase());
      const rulePriorities = (rule.priorities || []).map((p: string) => p.toUpperCase());
      const ruleTypes = (rule.ticketTypes || []).map((t: string) => t.toUpperCase());

      const categoryMatches = ruleCategories.length === 0 || ruleCategories.some((c: string) => upperCategory.includes(c) || c.includes(upperCategory));
      const priorityMatches = rulePriorities.length === 0 || rulePriorities.includes(upperPriority);
      const typeMatches = ruleTypes.length === 0 || ruleTypes.includes(type.toUpperCase());

      if (categoryMatches && priorityMatches && typeMatches) {
        if (rule.targetRoles && rule.targetRoles.length > 0) {
          rule.targetRoles.forEach((role: string) => matchedRoles.add(role));
        }
      }
    }

    let targetUsers: any[] = [];

    if (matchedRoles.size > 0) {
      this.logger.log(`Matching routing rule found! Target roles: ${Array.from(matchedRoles).join(', ')}`);
      targetUsers = await this.prisma.user.findMany({
        where: {
          roles: {
            some: {
              role: {
                name: {
                  in: Array.from(matchedRoles)
                }
              }
            }
          }
        }
      });
    }

    if (targetUsers.length === 0) {
      this.logger.log(`No specific routing rules matched. Falling back to ADMIN/TICKETING_ADMIN.`);
      targetUsers = await this.prisma.user.findMany({
        where: {
          roles: {
            some: {
              role: {
                name: {
                  in: ['ADMIN', 'TICKETING_ADMIN']
                }
              }
            }
          }
        }
      });
    }

    if (excludeUserId) {
      targetUsers = targetUsers.filter(u => u.id !== excludeUserId);
    }

    return targetUsers;
  }

  async broadcast(payload: {
    userIds: string[];
    sendAll: boolean;
    channels: string[];
    chatMessage: string;
    emailSubject?: string;
    emailMessage?: string;
  }) {
    const { userIds, sendAll, channels, chatMessage, emailSubject, emailMessage } = payload;
    
    const users = await this.prisma.user.findMany({
      where: sendAll ? {} : { id: { in: userIds } },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        telegramId: true
      }
    });

    const results = await Promise.allSettled(users.map(async (user) => {
      const userResult = {
        userId: user.id,
        fullName: user.fullName,
        channels: {} as Record<string, { success: boolean; message: string }>
      };

      const channelPromises: Promise<void>[] = [];

      if (channels.includes('WHATSAPP')) {
        channelPromises.push(
          user.phoneNumber
            ? this.sendWhatsApp(user.phoneNumber, chatMessage).then(r => { userResult.channels['WHATSAPP'] = r; })
            : Promise.resolve().then(() => { userResult.channels['WHATSAPP'] = { success: false, message: 'No phone number configured' }; })
        );
      }

      if (channels.includes('TELEGRAM')) {
        channelPromises.push(
          user.telegramId
            ? this.sendTelegram(user.telegramId, chatMessage).then(r => { userResult.channels['TELEGRAM'] = r; })
            : Promise.resolve().then(() => { userResult.channels['TELEGRAM'] = { success: false, message: 'No Telegram Chat ID configured' }; })
        );
      }

      if (channels.includes('EMAIL')) {
        channelPromises.push(
          user.email
            ? this.sendEmail(user.email, emailSubject || 'YATO Broadcast', emailMessage || chatMessage).then(r => { userResult.channels['EMAIL'] = r; })
            : Promise.resolve().then(() => { userResult.channels['EMAIL'] = { success: false, message: 'No email configured' }; })
        );
      }

      await Promise.allSettled(channelPromises);

      try {
        await this.create(
          user.id,
          emailSubject || 'Broadcast Message',
          chatMessage,
          'INFO'
        );
      } catch (err) {
        this.logger.error(`Failed to create internal broadcast log for user ${user.id}: ${err.message}`);
      }

      return userResult;
    }));

    const successfulResults = results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      .map(r => r.value);

    return {
      success: true,
      processed: successfulResults.length,
      details: successfulResults
    };
  }

  async getSetting(key: string) {
    const setting = await this.prisma.systemSetting.findUnique({ where: { key } });
    return setting?.value;
  }

  async getFrontendUrl(): Promise<string> {
    const now = Date.now();
    if (this.platformUrlCache && now - this.platformUrlCacheTime < 3600000) {
      return this.platformUrlCache;
    }
    try {
      const platformUrlSetting = await this.prisma.systemSetting.findUnique({
        where: { key: 'PLATFORM_URL' }
      });
      this.platformUrlCache = (platformUrlSetting?.value as string) || process.env.FRONTEND_URL || 'https://yato.honet.web.id';
      this.platformUrlCacheTime = now;
    } catch {
      this.platformUrlCache = process.env.FRONTEND_URL || 'https://yato.honet.web.id';
    }
    return this.platformUrlCache;
  }
}
