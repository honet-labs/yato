import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);

  constructor(
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
  ) {}

  @OnEvent('notification.trigger')
  async handleNotificationTriggerEvent(payload: {
    userId: string;
    type: string;
    title: string;
    message: string;
    recipient: string;
  }) {
    this.logger.log(`Received event 'notification.trigger' for user ${payload.userId}`);
    
    try {
      // Add job to BullMQ queue
      await this.notificationsQueue.add('send-notification', payload, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      });
      
      this.logger.debug(`Job added to notifications queue for recipient ${payload.recipient}`);
    } catch (error) {
      this.logger.error(`Failed to add notification job to BullMQ queue: ${error.message}`, error.stack);
    }
  }
}
