import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { replaceDatePlaceholders } from './task.service';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';

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
      });

      this.logger.log(`Found ${templates.length} active repeating blueprints/templates.`);

      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      // Normalize current day of week (1 = Monday, 7 = Sunday)
      const jsDay = now.getDay();
      const currentDayOfWeek = jsDay === 0 ? 7 : jsDay;
      const currentDayOfMonth = now.getDate();

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

        // 2. Perform schedule-type validation
        if (template.repeatInterval === 'DAILY') {
          if (!lastGen) {
            shouldGenerate = true;
          } else {
            const isSameDay =
              now.getFullYear() === lastGen.getFullYear() &&
              now.getMonth() === lastGen.getMonth() &&
              now.getDate() === lastGen.getDate();
            if (!isSameDay) {
              shouldGenerate = true;
            }
          }
        } else if (template.repeatInterval === 'WEEKLY') {
          const targetDayOfWeek = template.repeatDayOfWeek !== null && template.repeatDayOfWeek !== undefined
            ? Number(template.repeatDayOfWeek)
            : 1; // Default to Monday (1)
          
          if (currentDayOfWeek === targetDayOfWeek) {
            if (!lastGen) {
              shouldGenerate = true;
            } else {
              const diffTime = Math.abs(now.getTime() - lastGen.getTime());
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              const isSameDay =
                now.getFullYear() === lastGen.getFullYear() &&
                now.getMonth() === lastGen.getMonth() &&
                now.getDate() === lastGen.getDate();
              
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
            if (!lastGen) {
              shouldGenerate = true;
            } else {
              const diffTime = Math.abs(now.getTime() - lastGen.getTime());
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              const isSameDay =
                now.getFullYear() === lastGen.getFullYear() &&
                now.getMonth() === lastGen.getMonth() &&
                now.getDate() === lastGen.getDate();
              
              if (!isSameDay && diffDays >= 25) {
                shouldGenerate = true;
              }
            }
          }
        }

        if (shouldGenerate) {
          this.logger.log(
            `Generating automated task from template "${template.templateName}" (Interval: ${template.repeatInterval}, Scheduled Time: ${targetTime})`
          );

          // Create the Task
          await this.prisma.$transaction(async (tx) => {
            const task = await tx.task.create({
              data: {
                title: replaceDatePlaceholders(template.title),
                description: template.description || '',
                status: 'NOT_STARTED',
                priority: template.priority,
                taskType: template.taskType,
                checklist: template.checklist || [],
                createdById: template.createdById,
                templateId: template.id,
                tags: (template as any).tags || [],
              },
            });

            // Update template's lastGeneratedAt field
            await tx.taskTemplate.update({
              where: { id: template.id },
              data: { lastGeneratedAt: now },
            });

            try {
              await this.auditService.log(template.createdById, 'CREATE_TASK', 'Task', task.id, {
                title: task.title,
                templateId: template.id,
                reason: 'AUTOMATED_SCHEDULE',
              });
            } catch (err) {
              // Safe catch
            }
          });

          this.logger.log(`Successfully generated task for template ID: ${template.id}`);
        }
      }
    } catch (error) {
      this.logger.error('Error occurred in repeating task scheduler:', error.stack || error.message);
    }
  }

  // Daily reminder at 8:00 AM for tasks that are NOT_STARTED
  @Cron('0 8 * * *')
  async sendTaskReminders() {
    this.logger.log('⏰ Running daily task reminder check...');
    try {
      // Find all tasks with status 'NOT_STARTED' that have assignees
      const tasks = await this.prisma.task.findMany({
        where: {
          status: 'NOT_STARTED',
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

      this.logger.log(`Found ${tasks.length} NOT_STARTED tasks to process.`);

      const frontendUrl = process.env.FRONTEND_URL || 'https://yato.honet.web.id';

      for (const task of tasks) {
        if (!task.assignees || task.assignees.length === 0) {
          continue;
        }

        const taskUrl = `${frontendUrl}/tasks?taskId=${task.id}`;

        for (const assignee of task.assignees) {
          this.logger.log(`Sending task reminder for task "${task.title}" to assignee "${assignee.fullName || assignee.username}"`);
          
          try {
            await this.notificationService.sendToUserQueue(
              assignee.id,
              `Task Reminder: ${task.title}`,
              `Hello ${assignee.fullName || assignee.username},\n\nThis is a reminder that the task <b>${task.title}</b> is currently <b>Not Started</b>.\n\nPlease start working on it or update its status in the task tracker.\n\nLink: ${taskUrl}`,
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
    await this.handleRepeatingTasks();
    await this.sendTaskReminders();
  }
}
