import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class NoteService {
  private readonly logger = new Logger(NoteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  async create(userId: string, data: {
    title?: string;
    content: string;
    color?: string;
    isPinned?: boolean;
    isArchived?: boolean;
    isTrashed?: boolean;
    reminderAt?: string | Date;
  }) {
    const reminderDate = data.reminderAt ? new Date(data.reminderAt) : null;
    return this.prisma.note.create({
      data: {
        userId,
        title: data.title || null,
        content: data.content,
        color: data.color || '#ffffff',
        isPinned: data.isPinned ?? false,
        isArchived: data.isArchived ?? false,
        isTrashed: data.isTrashed ?? false,
        reminderAt: reminderDate,
        reminderSent: false,
      },
    });
  }

  async findAll(userId: string, query?: {
    isPinned?: boolean;
    isArchived?: boolean;
    isTrashed?: boolean;
    hasReminder?: boolean;
  }) {
    const whereClause: any = { userId };

    if (query) {
      if (query.isPinned !== undefined) whereClause.isPinned = query.isPinned;
      if (query.isArchived !== undefined) whereClause.isArchived = query.isArchived;
      if (query.isTrashed !== undefined) {
        whereClause.isTrashed = query.isTrashed;
      } else {
        whereClause.isTrashed = false; // Exclude trashed notes by default
      }
      if (query.hasReminder === true) {
        whereClause.reminderAt = { not: null };
      }
    } else {
      whereClause.isTrashed = false;
    }

    return this.prisma.note.findMany({
      where: whereClause,
      orderBy: [
        { isPinned: 'desc' },
        { updatedAt: 'desc' },
      ],
    });
  }

  async findOne(id: string, userId: string) {
    const note = await this.prisma.note.findFirst({
      where: { id, userId },
    });
    if (!note) {
      throw new NotFoundException('Note not found');
    }
    return note;
  }

  async update(id: string, userId: string, data: {
    title?: string;
    content?: string;
    color?: string;
    isPinned?: boolean;
    isArchived?: boolean;
    isTrashed?: boolean;
    reminderAt?: string | Date | null;
  }) {
    // Verify note ownership
    await this.findOne(id, userId);

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.isPinned !== undefined) updateData.isPinned = data.isPinned;
    if (data.isArchived !== undefined) updateData.isArchived = data.isArchived;
    if (data.isTrashed !== undefined) updateData.isTrashed = data.isTrashed;
    
    if (data.reminderAt !== undefined) {
      if (data.reminderAt === null) {
        updateData.reminderAt = null;
        updateData.reminderSent = false;
      } else {
        updateData.reminderAt = new Date(data.reminderAt);
        updateData.reminderSent = false; // Reset sent status for new/updated reminder
      }
    }

    return this.prisma.note.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string, userId: string) {
    // Verify note ownership
    await this.findOne(id, userId);

    return this.prisma.note.delete({
      where: { id },
    });
  }

  async emptyTrash(userId: string) {
    return this.prisma.note.deleteMany({
      where: {
        userId,
        isTrashed: true,
      },
    });
  }

  @Cron('*/1 * * * *') // Runs every minute
  async handleNoteReminders() {
    const now = new Date();
    this.logger.debug('Checking note reminders...');
    try {
      const pendingNotes = await this.prisma.note.findMany({
        where: {
          reminderAt: {
            lte: now,
          },
          reminderSent: false,
          isTrashed: false,
        },
      });

      for (const note of pendingNotes) {
        try {
          const title = note.title || 'Note Reminder';
          const message = note.content;

          // Call the existing notification service to queue WhatsApp, Telegram, or Email notifications
          await this.notificationService.sendToUserQueue(
            note.userId,
            `Reminder: ${title}`,
            message
          );

          // Mark as sent
          await this.prisma.note.update({
            where: { id: note.id },
            data: { reminderSent: true },
          });

          this.logger.log(`Reminder sent for note ${note.id} to user ${note.userId}`);
        } catch (err) {
          this.logger.error(`Error sending reminder for note ${note.id}: ${err.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error in handleNoteReminders: ${error.message}`);
    }
  }
}
