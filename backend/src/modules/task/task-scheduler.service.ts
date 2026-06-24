import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { replaceDatePlaceholders } from './task.service';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';

function getLocalDateParts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0', 10);

  const year = getPart('year');
  const month = getPart('month') - 1; // 0-indexed month
  const day = getPart('day');
  const hour = getPart('hour') % 24;
  const minute = getPart('minute');

  const tempDate = new Date(Date.UTC(year, month, day));
  const jsDay = tempDate.getUTCDay();
  const dayOfWeek = jsDay === 0 ? 7 : jsDay;

  return { year, month, day, hour, minute, dayOfWeek };
}

@Injectable()
export class TaskSchedulerService {
  private readonly logger = new Logger(TaskSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationService: NotificationService,
  ) {}

  // Run scheduler every 10 minutes to check precision scheduling
  @Cron('*/10 * * * *')
  async handleRepeatingTasks() {
    this.logger.log('⏰ Running repeating task scheduler check...');
    try {
      const templates = await this.prisma.taskTemplate.findMany({
        where: {
          repeatInterval: {
            in: ['DAILY', 'WEEKLY', 'MONTHLY'],
          },
        },
        include: {
          projects: true,
        },
      });

      this.logger.log(`Found ${templates.length} active repeating blueprints/templates.`);

      // Get the configured system timezone
      let timezone = 'Asia/Jakarta';
      try {
        const tzSetting = await this.prisma.systemSetting.findUnique({ where: { key: 'TIMEZONE_CONFIG' } });
        const tzConfig: any = tzSetting?.value || {};
        if (tzConfig.mode === 'MANUAL' && tzConfig.manualValue) {
          timezone = tzConfig.manualValue;
        } else {
          timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        }
      } catch (e) {
        // Fallback to Asia/Jakarta
      }

      this.logger.log(`Using timezone for repeating tasks: ${timezone}`);

      const now = new Date();
      const nowParts = getLocalDateParts(now, timezone);

      const currentHour = nowParts.hour;
      const currentMinute = nowParts.minute;
      const currentDayOfWeek = nowParts.dayOfWeek;
      const currentDayOfMonth = nowParts.day;

      for (const template of templates) {
        let shouldGenerate = false;
        const lastGen = template.lastGeneratedAt ? new Date(template.lastGeneratedAt) : null;

        // 1. Parse target time (e.g. "09:00" -> hour: 9, minute: 0)
        const targetTime = template.repeatTime || '00:00';
        const [tHourStr, tMinStr] = targetTime.split(':');
        const targetHour = parseInt(tHourStr, 10) || 0;
        const targetMin = parseInt(tMinStr, 10) || 0;

        // Check if we've reached or passed the scheduled time today
        const isTimeReached = (currentHour * 60 + currentMinute) >= (targetHour * 60 + targetMin);

        if (!isTimeReached) {
          continue; // It's too early today for this template, skip it
        }

        const lastGenParts = lastGen ? getLocalDateParts(lastGen, timezone) : null;

        // 2. Perform schedule-type validation
        if (template.repeatInterval === 'DAILY') {
          if (!lastGenParts) {
            shouldGenerate = true;
          } else {
            const isSameDay =
              nowParts.year === lastGenParts.year &&
              nowParts.month === lastGenParts.month &&
              nowParts.day === lastGenParts.day;
            if (!isSameDay) {
              shouldGenerate = true;
            }
          }
        } else if (template.repeatInterval === 'WEEKLY') {
          const targetDayOfWeek = template.repeatDayOfWeek !== null && template.repeatDayOfWeek !== undefined
            ? Number(template.repeatDayOfWeek)
            : 1; // Default to Monday (1)
          
          if (currentDayOfWeek === targetDayOfWeek) {
            if (!lastGenParts) {
              shouldGenerate = true;
            } else {
              const diffTime = Math.abs(now.getTime() - lastGen.getTime());
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              const isSameDay =
                nowParts.year === lastGenParts.year &&
                nowParts.month === lastGenParts.month &&
                nowParts.day === lastGenParts.day;
              
              if (!isSameDay && diffDays >= 6) {
                shouldGenerate = true;
              }
            }
          }
        } else if (template.repeatInterval === 'MONTHLY') {
          const targetDayOfMonth = template.repeatDayOfMonth !== null && template.repeatDayOfMonth !== undefined
            ? Number(template.repeatDayOfMonth)
            : 1; // Default to 1st of the month
          
          if (currentDayOfMonth === targetDayOfMonth) {
            if (!lastGenParts) {
              shouldGenerate = true;
            } else {
              const diffTime = Math.abs(now.getTime() - lastGen.getTime());
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              const isSameDay =
                nowParts.year === lastGenParts.year &&
                nowParts.month === lastGenParts.month &&
                nowParts.day === lastGenParts.day;
              
              if (!isSameDay && diffDays >= 25) {
                shouldGenerate = true;
              }
            }
          }
        }

        if (shouldGenerate) {
          this.logger.log(
            `Generating automated tasks from template "${template.templateName}" (Interval: ${template.repeatInterval}, Scheduled Time: ${targetTime})`
          );

          const generatedTasks = [];
          const projectList = (template as any).projects && (template as any).projects.length > 0
            ? (template as any).projects
            : [null];

          await this.prisma.$transaction(async (tx) => {
            for (const proj of projectList) {
              const t = await tx.task.create({
                data: {
                  title: replaceDatePlaceholders(template.title),
                  description: template.description || '',
                  status: 'NOT_STARTED',
                  priority: template.priority,
                  taskType: template.taskType,
                  checklist: template.checklist || [],
                  createdById: template.createdById,
                  templateId: template.id,
                  projectId: proj ? proj.id : null,
                  tags: (template as any).tags || [],
                  assigneeId: template.createdById,
                  assignees: {
                    connect: [{ id: template.createdById }]
                  }
                },
              });
              generatedTasks.push(t);

              try {
                await this.auditService.log(template.createdById, 'CREATE_TASK', 'Task', t.id, {
                  title: t.title,
                  templateId: template.id,
                  reason: 'AUTOMATED_SCHEDULE',
                });
              } catch (err) {
                // Safe catch
              }
            }

            // Update template's lastGeneratedAt field
            await tx.taskTemplate.update({
              where: { id: template.id },
              data: { lastGeneratedAt: now },
            });
          });

          this.logger.log(`Successfully generated ${generatedTasks.length} tasks for template ID: ${template.id}`);

          // Trigger immediate notifications for the generated tasks
          try {
            const platformUrlSetting = await this.prisma.systemSetting.findUnique({
              where: { key: 'PLATFORM_URL' }
            });
            const frontendUrl = (platformUrlSetting?.value as string) || process.env.FRONTEND_URL || 'https://yato.honet.web.id';
            
            for (const task of generatedTasks) {
              const taskUrl = `${frontendUrl}/tasks?taskId=${task.id}`;
              const workspaceName = projectList.find(p => p?.id === task.projectId)?.name || 'Global';
              await this.notificationService.sendToUserQueue(
                template.createdById,
                `New Repeating Task Generated`,
                `Hello,\n\nA new automated task <b>${task.title}</b> has been generated in workspace <b>${workspaceName}</b> from your daily template <b>${template.templateName}</b>.\n\nLink: ${taskUrl}`,
              );
            }
            this.logger.log(`Dispatched generation notifications for template ID: ${template.id} to user ${template.createdById}`);
          } catch (notificationError) {
            this.logger.error(`Failed to send generation notifications for template ${template.id}: ${notificationError.message}`);
          }
        }
      }
    } catch (error) {
      this.logger.error('Error occurred in repeating task scheduler:', error.stack || error.message);
    }
  }

  // Daily reminder at 8:00 AM for tasks that are NOT_STARTED or IN_PROGRESS
  @Cron('0 8 * * *')
  async sendTaskReminders() {
    this.logger.log('⏰ Running daily task reminder check...');
    try {
      // Find all tasks with status 'NOT_STARTED' or 'IN_PROGRESS' that have assignees
      const tasks = await this.prisma.task.findMany({
        where: {
          status: {
            in: ['NOT_STARTED', 'IN_PROGRESS'],
          },
        },
        include: {
          assignees: {
            select: {
              id: true,
              fullName: true,
              username: true,
              email: true,
              phoneNumber: true,
              telegramId: true,
            },
          },
        },
      });

      this.logger.log(`Found ${tasks.length} active tasks (NOT_STARTED/IN_PROGRESS) to process.`);

      const platformUrlSetting = await this.prisma.systemSetting.findUnique({
        where: { key: 'PLATFORM_URL' }
      });
      const frontendUrl = (platformUrlSetting?.value as string) || process.env.FRONTEND_URL || 'https://yato.honet.web.id';

      // Load reminder config limit
      const reminderConfigSetting = await this.prisma.systemSetting.findUnique({
        where: { key: 'REMINDER_CONFIG' }
      });
      const reminderConfig = (reminderConfigSetting?.value as any) || { taskMaxCount: 3 };
      const maxCount = reminderConfig.taskMaxCount ?? 3;

      for (const task of tasks) {
        if (!task.assignees || task.assignees.length === 0) {
          continue;
        }

        const taskUrl = `${frontendUrl}/tasks?taskId=${task.id}`;
        const statusLabel = task.status === 'IN_PROGRESS' ? 'In Progress' : 'Not Started';
        const actionLabel = task.status === 'IN_PROGRESS' 
          ? 'Please continue working on it or update its status once completed.' 
          : 'Please start working on it or update its status in the task tracker.';

        for (const assignee of task.assignees) {
          // Check how many reminders have already been sent for this task to this assignee
          const sentCount = await this.prisma.notification.count({
            where: {
              userId: assignee.id,
              type: 'TASK_REMINDER',
              link: {
                contains: task.id
              }
            }
          });

          if (sentCount >= maxCount) {
            this.logger.log(`Reminder limit (${maxCount}) reached for task "${task.title}" (sent: ${sentCount}) to assignee "${assignee.fullName || assignee.username}". Skipping.`);
            continue;
          }

          this.logger.log(`Sending task reminder for task "${task.title}" to assignee "${assignee.fullName || assignee.username}" (reminder ${sentCount + 1}/${maxCount})`);
          
          try {
            await this.notificationService.sendToUserQueue(
              assignee.id,
              `Task Reminder: ${task.title}`,
              `Hello ${assignee.fullName || assignee.username},\n\nThis is a reminder that the task <b>${task.title}</b> is currently <b>${statusLabel}</b>.\n\n${actionLabel}\n\nLink: ${taskUrl}`,
              taskUrl,
              'TASK_REMINDER'
            );
          } catch (err) {
            this.logger.error(`Failed to send reminder for task ${task.id} to user ${assignee.id}: ${err.message}`);
          }
        }
      }
    } catch (error) {
      this.logger.error('Error occurred in task reminder job:', error.stack || error.message);
    }
  }

  // Also run on application startup to ensure repeating tasks and initial alerts are handled
  async onApplicationBootstrap() {
    this.logger.log('🚀 Bootstrapping Repeating Task Scheduler...');
    try {
      await this.handleRepeatingTasks();
    } catch (e) {
      this.logger.error('Failed to run bootstrapping repeating tasks:', e.stack || e.message);
    }
    try {
      await this.sendTaskReminders();
    } catch (e) {
      this.logger.error('Failed to run bootstrapping task reminders:', e.stack || e.message);
    }
  }
}
