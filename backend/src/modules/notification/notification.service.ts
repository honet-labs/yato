import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';
import * as nodemailer from 'nodemailer';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

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

  // Compatibility method for worker
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

  async markAsRead(id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  // Email logic
  async sendEmail(to: string, subject: string, text: string, config?: any) {
    try {
      const emailConfig = config || await this.getSetting('EMAIL_CONFIG');
      if (!emailConfig) throw new Error('Email configuration not found');

      const transporter = nodemailer.createTransport({
        host: emailConfig.host,
        port: parseInt(emailConfig.port),
        secure: emailConfig.security === 'SSL',
        auth: {
          user: emailConfig.user,
          pass: emailConfig.pass,
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      await transporter.sendMail({
        from: `"YATO" <${emailConfig.user}>`,
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

  // WhatsApp logic (WAHA)
  async sendWhatsApp(to: string, message: string, config?: any) {
    try {
      const waConfig = config || await this.getSetting('WHATSAPP_CONFIG');
      if (!waConfig) throw new Error('WhatsApp configuration not found');

      // Normalize phone number: keep only digits
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

  // Telegram logic
  async sendTelegram(chatId: string, message: string, config?: any) {
    try {
      const tgConfig = config || await this.getSetting('TELEGRAM_CONFIG');
      if (!tgConfig) throw new Error('Telegram configuration not found');

      const botToken = tgConfig.botToken;
      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

      // Helper to escape HTML characters for Telegram
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

        // Protect <a> tags with href
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

    // 1. Try Telegram if ID exists (snoozed if on leave)
    if (user.telegramId && !isOnLeave) {
      await this.sendTelegram(user.telegramId, fullMessage);
    }

    // 2. Try WhatsApp if phone exists (snoozed if on leave)
    if (user.phoneNumber && !isOnLeave) {
      await this.sendWhatsApp(user.phoneNumber, fullMessage);
    }

    // 3. Try Email if email exists (snoozed if on leave)
    if (user.email && !isOnLeave) {
      const plainMessage = message.replace(/<[^>]*>/g, '');
      await this.sendEmail(user.email, title, plainMessage);
    }

    // Automatically extract link from message if present
    let extractedLink = undefined;
    if (message) {
      const linkMatch = message.match(/Link:\s*(https?:\/\/[^\s<]+|\/[^\s<]+)/i);
      if (linkMatch && linkMatch[1]) {
        extractedLink = linkMatch[1];
      }
    }

    // 4. Always create internal notification
    await this.create(userId, title, message, extractedLink ? 'TICKET_UPDATE' : 'INFO', extractedLink);
  }

  async sendToUserQueue(userId: string, title: string, message: string, link?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;

    const isOnLeave = await this.isUserOnLeave(userId);
    if (isOnLeave) {
      this.logger.log(`User ${user.fullName} (${userId}) is currently ON LEAVE. Auto-snoozing external queued alerts.`);
    }

    const plainMessage = message.replace(/<[^>]*>/g, '');

    // 1. Queue Telegram if ID exists (snoozed if on leave)
    if (user.telegramId && !isOnLeave) {
      this.logger.log(`Queuing Telegram notification for user ${user.id} (${user.telegramId})`);
      this.eventEmitter.emit('notification.trigger', {
        userId: user.id,
        type: 'TELEGRAM',
        title,
        message, // HTML message supported by Telegram
        recipient: user.telegramId
      });
    }

    // 2. Queue WhatsApp if phone exists (snoozed if on leave)
    if (user.phoneNumber && !isOnLeave) {
      this.logger.log(`Queuing WhatsApp notification for user ${user.id} (${user.phoneNumber})`);
      this.eventEmitter.emit('notification.trigger', {
        userId: user.id,
        type: 'WHATSAPP',
        title,
        message: plainMessage,
        recipient: user.phoneNumber
      });
    }

    // 3. Queue Email if email exists (snoozed if on leave)
    if (user.email && !isOnLeave) {
      this.logger.log(`Queuing Email notification for user ${user.id} (${user.email})`);
      this.eventEmitter.emit('notification.trigger', {
        userId: user.id,
        type: 'EMAIL',
        title,
        message: plainMessage,
        recipient: user.email
      });
    }

    // Automatically extract link from message if not explicitly provided
    let finalLink = link;
    if (!finalLink && message) {
      const linkMatch = message.match(/Link:\s*(https?:\/\/[^\s<]+|\/[^\s<]+)/i);
      if (linkMatch && linkMatch[1]) {
        finalLink = linkMatch[1];
      }
    }

    // 4. Always create internal notification immediately
    await this.create(userId, title, message, finalLink ? 'TICKET_UPDATE' : 'INFO', finalLink);
  }


  async getRecipientsForTicket(params: {
    type: 'SUPPORT' | 'VM' | 'SERVICE';
    category?: string;
    priority?: string;
    excludeUserId?: string;
  }): Promise<any[]> {
    const { type, category = 'GENERAL', priority = 'NORMAL', excludeUserId } = params;

    // 1. Fetch system routing rules from SystemSetting
    let rules: any[] = [];
    try {
      const rulesSetting = await this.prisma.systemSetting.findUnique({
        where: { key: 'NOTIFICATION_ROUTING_RULES' }
      });
      if (rulesSetting && rulesSetting.value) {
        rules = rulesSetting.value as any[];
      } else {
        // Provide standard intelligent default rules
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
        // Create the setting with default value so it persists in DB
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

    // 2. Find matching rules
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

    // 3. Query target users
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

    // 4. Fallback if no matching rules found or no users found with matched roles
    if (targetUsers.length === 0) {
      this.logger.log(`No specific routing rules matched or target users empty. Falling back to all users with ADMIN or TICKETING_ADMIN roles.`);
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

    // 5. Exclude requester/updater if requested
    if (excludeUserId) {
      targetUsers = targetUsers.filter(u => u.id !== excludeUserId);
    }

    return targetUsers;
  }

  async getSetting(key: string) {
    const setting = await this.prisma.systemSetting.findUnique({ where: { key } });
    return setting?.value;
  }
}
