import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { NotificationService } from '../notification.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditService } from '../../audit/audit.service';

@Processor('notifications', {
  concurrency: parseInt(process.env.NOTIFICATION_CONCURRENCY || '5', 10),
})
export class NotificationWorker extends WorkerHost {
  private readonly logger = new Logger(NotificationWorker.name);

  constructor(
    private notificationService: NotificationService,
    private eventEmitter: EventEmitter2,
    private auditService: AuditService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { userId, type, title, message, recipient } = job.data;

    this.logger.log(`[NotificationWorker] Processing job ${job.id} for user ${userId}. Type: ${type}, Recipient: ${recipient}`);

    // Verify system integration configuration
    if (type === 'EMAIL') {
      const config = (await this.notificationService.getSetting('EMAIL_CONFIG')) as any;
      if (!config || !config.host || !config.user) {
        this.logger.warn(`[NotificationWorker] Skipping Email notification: SMTP is not configured.`);
        await this.auditService.log(userId, 'SEND_NOTIFICATION_SKIPPED', 'Notification', null, {
          type,
          recipient,
          reason: 'SMTP is not configured'
        });
        this.eventEmitter.emit('notification.finished', {
          userId,
          success: true,
          message: `Email notification skipped: SMTP is not configured.`,
          type
        });
        return { success: true, skipped: true };
      }
    } else if (type === 'WHATSAPP') {
      const config = (await this.notificationService.getSetting('WHATSAPP_CONFIG')) as any;
      if (!config || !config.url) {
        this.logger.warn(`[NotificationWorker] Skipping WhatsApp notification: WAHA gateway is not configured.`);
        await this.auditService.log(userId, 'SEND_NOTIFICATION_SKIPPED', 'Notification', null, {
          type,
          recipient,
          reason: 'WAHA gateway is not configured'
        });
        this.eventEmitter.emit('notification.finished', {
          userId,
          success: true,
          message: `WhatsApp notification skipped: WAHA gateway is not configured.`,
          type
        });
        return { success: true, skipped: true };
      }
    } else if (type === 'TELEGRAM') {
      const config = (await this.notificationService.getSetting('TELEGRAM_CONFIG')) as any;
      if (!config || !config.botToken) {
        this.logger.warn(`[NotificationWorker] Skipping Telegram notification: Bot token is not configured.`);
        await this.auditService.log(userId, 'SEND_NOTIFICATION_SKIPPED', 'Notification', null, {
          type,
          recipient,
          reason: 'Bot token is not configured'
        });
        this.eventEmitter.emit('notification.finished', {
          userId,
          success: true,
          message: `Telegram notification skipped: Bot token is not configured.`,
          type
        });
        return { success: true, skipped: true };
      }
    }

    // Verify user notification preferences for this channel type
    const isChannelEnabled = await this.notificationService.checkUserPreference(userId, type);
    if (!isChannelEnabled) {
      this.logger.log(`[NotificationWorker] Skipping ${type} notification dispatch for user ${userId} due to channel disabled in user settings.`);
      await this.auditService.log(userId, 'SEND_NOTIFICATION_SKIPPED', 'Notification', null, {
        type,
        recipient,
        reason: 'Disabled in user settings'
      });
      
      this.eventEmitter.emit('notification.finished', {
        userId,
        success: true,
        message: `Notification skipped: ${type} is disabled in user preferences.`,
        type
      });
      
      return { success: true };
    }

    let success = false;
    let errorDetail = '';

    try {
      let result;
      if (type === 'EMAIL') {
        this.logger.log(`[NotificationWorker] Attempting to send Email to ${recipient}...`);
        result = await this.notificationService.sendEmail(recipient, title, message);
      } else if (type === 'WHATSAPP') {
        this.logger.log(`[NotificationWorker] Attempting to send WhatsApp message to ${recipient}...`);
        result = await this.notificationService.sendWhatsApp(recipient, message);
      } else if (type === 'TELEGRAM') {
        this.logger.log(`[NotificationWorker] Attempting to send Telegram message to ${recipient}...`);
        result = await this.notificationService.sendTelegram(recipient, message);
      } else {
        throw new Error(`Unsupported notification type: ${type}`);
      }

      if (result && result.success) {
        success = true;
        this.logger.log(`[NotificationWorker] Job ${job.id} succeeded. Notification sent to ${recipient} via ${type}.`);
        await this.auditService.log(userId, 'SEND_NOTIFICATION_SUCCESS', 'Notification', null, {
          type,
          recipient,
          title
        });
      } else {
        errorDetail = result?.message || 'Unknown error';
        this.logger.error(`[NotificationWorker] Job ${job.id} failed to send to ${recipient} via ${type}. Details: ${errorDetail}`);
        await this.auditService.log(userId, 'SEND_NOTIFICATION_FAILED', 'Notification', null, {
          type,
          recipient,
          error: errorDetail
        });
      }
    } catch (error) {
      errorDetail = error.message;
      this.logger.error(`[NotificationWorker] Unexpected error in job ${job.id} while sending to ${recipient} via ${type}: ${error.message}`, error.stack);
      await this.auditService.log(userId, 'SEND_NOTIFICATION_FAILED', 'Notification', null, {
        type,
        recipient,
        error: errorDetail
      });
    }

    // Emit finished event
    this.logger.log(`[NotificationWorker] Emitting notification.finished event for user ${userId}`);
    this.eventEmitter.emit('notification.finished', {
      userId,
      success,
      message: success 
        ? `Notification sent successfully to ${recipient} via ${type}`
        : `Failed to send notification to ${recipient} via ${type}. Error: ${errorDetail}`,
      type
    });

    if (!success) {
      throw new Error(`Notification delivery failed: ${errorDetail}`);
    }

    return { success: true };
  }
}
