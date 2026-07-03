import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CleanupSchedulerService {
  private readonly logger = new Logger(CleanupSchedulerService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Run daily at 3:00 AM
  @Cron('0 3 * * *')
  async cleanupLoginHistory() {
    this.logger.log('Running LoginHistory cleanup...');
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90);

      const result = await this.prisma.loginHistory.deleteMany({
        where: {
          loginTime: {
            lt: cutoffDate,
          },
        },
      });

      this.logger.log(`LoginHistory cleanup completed. Deleted ${result.count} records older than 90 days.`);
    } catch (error) {
      this.logger.error('LoginHistory cleanup failed:', error.stack || error.message);
    }
  }

  async onApplicationBootstrap() {
    this.logger.log('Bootstrapping Cleanup Scheduler...');
    try {
      await this.cleanupLoginHistory();
    } catch (e) {
      this.logger.error('Failed to run bootstrapping cleanup:', e.stack || e.message);
    }
  }
}
