import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class HrmSchedulerService {
  private readonly logger = new Logger(HrmSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleAttendanceReminders() {
    this.logger.log('Running automatic HRM attendance shift reminders check...');
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

      // Load reminder config limit
      const reminderConfigSetting = await this.prisma.systemSetting.findUnique({
        where: { key: 'REMINDER_CONFIG' }
      });
      const reminderConfig = (reminderConfigSetting?.value as any) || { hrmMaxCount: 1 };
      const hrmMaxCount = reminderConfig.hrmMaxCount ?? 1;

      // Get all work shifts for today
      const shiftsToday = await this.prisma.workShift.findMany({
        where: {
          date: { gte: startOfDay, lte: endOfDay },
        },
        include: {
          user: true,
          shiftCategory: true,
        },
      });

      for (const shift of shiftsToday) {
        const user = shift.user;
        const category = shift.shiftCategory;

        if (!user || !category) continue;

        // Parse shift start and end times
        const [startHour, startMin] = category.startTime.split(':').map(Number);
        const [endHour, endMin] = category.endTime.split(':').map(Number);

        const shiftStart = new Date(now);
        shiftStart.setHours(startHour, startMin, 0, 0);

        const shiftEnd = new Date(now);
        shiftEnd.setHours(endHour, endMin, 0, 0);

        // Fetch current day's timesheet for the user
        const timesheet = await this.prisma.timesheet.findFirst({
          where: {
            userId: user.id,
            date: { gte: startOfDay, lte: endOfDay },
          },
          include: { logs: true },
        });

        // =====================================================================
        // 1. CLOCK-IN REMINDER (15 minutes before shift starts)
        // =====================================================================
        const reminderWindowStart = new Date(shiftStart.getTime() - 15 * 60 * 1000);
        const hasClockedIn = timesheet && timesheet.logs.some(l => l.type === 'CHECK_IN');

        if (now >= reminderWindowStart && now < shiftStart && !hasClockedIn) {
          // Check if already sent today to avoid spamming
          const sentCount = await this.prisma.notification.count({
            where: {
              userId: user.id,
              type: 'HRM_REMINDER_IN',
              createdAt: { gte: startOfDay, lte: endOfDay },
            },
          });

          if (sentCount < hrmMaxCount) {
            const title = '⏰ Pengingat Masuk Shift (Clock-in)';
            const message = `Halo ${user.fullName}, jangan lupa untuk melakukan Clock-in hari ini ya! Shift Anda <b>${category.name}</b> akan dimulai pada pukul <b>${category.startTime}</b>. Silakan masuk ke menu Attendance Control untuk Clock-in.`;
            this.logger.log(`Sending Clock-in reminder to user ${user.fullName} (${user.id}) (reminder ${sentCount + 1}/${hrmMaxCount})`);
            
            // Log as specific notification type
            await this.prisma.notification.create({
              data: {
                userId: user.id,
                title,
                message,
                type: 'HRM_REMINDER_IN',
              }
            });

            await this.notificationService.sendToUserQueue(user.id, title, message, '/hrm/attendance');
          }
        }

        // =====================================================================
        // 2. CLOCK-OUT REMINDER (15 minutes after shift ends)
        // =====================================================================
        const reminderOutWindowStart = new Date(shiftEnd.getTime() + 15 * 60 * 1000);
        const lastLog = timesheet?.logs?.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
        const isCurrentlyCheckedIn = lastLog && lastLog.type === 'CHECK_IN';

        if (now >= reminderOutWindowStart && isCurrentlyCheckedIn) {
          // Check if already sent today
          const sentCount = await this.prisma.notification.count({
            where: {
              userId: user.id,
              type: 'HRM_REMINDER_OUT',
              createdAt: { gte: startOfDay, lte: endOfDay },
            },
          });

          if (sentCount < hrmMaxCount) {
            const title = '⏰ Pengingat Pulang Shift (Clock-out)';
            const message = `Halo ${user.fullName}, waktu shift Anda <b>${category.name}</b> telah selesai pada pukul <b>${category.endTime}</b>. Jangan lupa untuk melakukan Clock-out ya untuk merekam jam kerja Anda secara akurat hari ini!`;
            this.logger.log(`Sending Clock-out reminder to user ${user.fullName} (${user.id}) (reminder ${sentCount + 1}/${hrmMaxCount})`);

            await this.prisma.notification.create({
              data: {
                userId: user.id,
                title,
                message,
                type: 'HRM_REMINDER_OUT',
              }
            });

            await this.notificationService.sendToUserQueue(user.id, title, message, '/hrm/attendance');
          }
        }
      }
    } catch (e) {
      this.logger.error(`Error in handleAttendanceReminders: ${e.message}`, e.stack);
    }
  }
}
