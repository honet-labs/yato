import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class NoteService {
  private readonly logger = new Logger(NoteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly auditService: AuditService,
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
    this.logger.log(`Creating note for user: ${userId}. Title: "${data.title || 'Untitled'}"`);
    const reminderDate = data.reminderAt ? new Date(data.reminderAt) : null;
    try {
      const note = await this.prisma.note.create({
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
      this.logger.log(`Successfully created note ${note.id} for user: ${userId}`);
      await this.auditService.log(userId, 'CREATE_NOTE', 'Note', note.id, { title: note.title });
      return note;
    } catch (err) {
      this.logger.error(`Failed to create note for user ${userId}: ${err.message}`, err.stack);
      throw err;
    }
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
    this.logger.log(`Updating note ${id} for user ${userId}. Keys to update: ${Object.keys(data).join(', ')}`);
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

    try {
      const note = await this.prisma.note.update({
        where: { id },
        data: updateData,
      });
      this.logger.log(`Successfully updated note ${id} for user ${userId}`);
      await this.auditService.log(userId, 'UPDATE_NOTE', 'Note', id, updateData);
      return note;
    } catch (err) {
      this.logger.error(`Failed to update note ${id} for user ${userId}: ${err.message}`, err.stack);
      throw err;
    }
  }

  async remove(id: string, userId: string) {
    this.logger.log(`Deleting note ${id} for user ${userId}`);
    // Verify note ownership
    await this.findOne(id, userId);

    try {
      const note = await this.prisma.note.delete({
        where: { id },
      });
      this.logger.log(`Successfully deleted note ${id} for user ${userId}`);
      await this.auditService.log(userId, 'DELETE_NOTE', 'Note', id);
      return note;
    } catch (err) {
      this.logger.error(`Failed to delete note ${id} for user ${userId}: ${err.message}`, err.stack);
      throw err;
    }
  }

  async emptyTrash(userId: string) {
    this.logger.log(`Emptying trashed notes for user ${userId}`);
    try {
      const result = await this.prisma.note.deleteMany({
        where: {
          userId,
          isTrashed: true,
        },
      });
      this.logger.log(`Successfully emptied trash for user ${userId}. Deleted ${result.count} notes.`);
      await this.auditService.log(userId, 'EMPTY_TRASH_NOTES', 'Note');
      return result;
    } catch (err) {
      this.logger.error(`Failed to empty trash for user ${userId}: ${err.message}`, err.stack);
      throw err;
    }
  }

  @Cron('*/1 * * * *') // Runs every minute
  async handleNoteReminders() {
    const now = new Date();
    this.logger.log('Checking note reminders scheduler...');
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

      if (pendingNotes.length > 0) {
        this.logger.log(`Found ${pendingNotes.length} pending note reminders to send.`);
      }

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

          this.logger.log(`Reminder notification successfully sent for note ${note.id} to user ${note.userId}`);
          await this.auditService.log(note.userId, 'SEND_NOTE_REMINDER', 'NoteReminder', note.id, { title });
        } catch (err) {
          this.logger.error(`Error sending reminder notification for note ${note.id}: ${err.message}`, err.stack);
        }
      }
    } catch (error) {
      this.logger.error(`Error in handleNoteReminders scheduler: ${error.message}`, error.stack);
    }
  }
}
