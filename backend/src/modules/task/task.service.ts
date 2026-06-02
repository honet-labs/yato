import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto, UpdateTaskDto, CreateTaskCommentDto, CreateTaskTemplateDto, UpdateTaskTemplateDto } from './dto/task.dto';
import { StorageService } from '../storage/storage.service';
import { NotificationService } from '../notification/notification.service';
import { AuditService } from '../audit/audit.service';

export function replaceDatePlaceholders(title: string): string {
  if (!title) return title;
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = String(now.getFullYear());
  const yy = yyyy.substring(2);

  return title
    .replace(/dd\/mm\/yyyy/gi, `${dd}/${mm}/${yyyy}`)
    .replace(/dd-mm-yyyy/gi, `${dd}-${mm}-${yyyy}`)
    .replace(/yyyy-mm-dd/gi, `${yyyy}-${mm}-${dd}`)
    .replace(/yyyy\/mm\/dd/gi, `${yyyy}/${mm}/${dd}`)
    .replace(/dd\/mm\/yy/gi, `${dd}/${mm}/${yy}`)
    .replace(/dd-mm-yy/gi, `${dd}-${mm}-${yy}`);
}

@Injectable()
export class TaskService {
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
    private notificationService: NotificationService,
    private auditService: AuditService,
  ) {}

  async findAll(user: any) {
    const where = {
      OR: [
        { createdById: user.id },
        { assignees: { some: { id: user.id } } },
        { followers: { some: { id: user.id } } }
      ]
    };

    return this.prisma.task.findMany({
      where,
      include: {
        template: {
          select: {
            id: true,
            templateName: true,
          },
        },
        assignee: {
          select: {
            id: true,
            fullName: true,
            username: true,
            email: true,
          },
        },
        assignees: {
          select: {
            id: true,
            fullName: true,
            username: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            fullName: true,
            username: true,
          },
        },
        updatedBy: {
          select: {
            id: true,
            fullName: true,
            username: true,
          },
        },
        followers: {
          select: {
            id: true,
            fullName: true,
            username: true,
          },
        },
        _count: {
          select: { comments: true }
        }
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string, user?: any) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        template: {
          select: {
            id: true,
            templateName: true,
          },
        },
        assignee: {
          select: {
            id: true,
            fullName: true,
            username: true,
            email: true,
          },
        },
        assignees: {
          select: {
            id: true,
            fullName: true,
            username: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            fullName: true,
            username: true,
            email: true,
          },
        },
        updatedBy: {
          select: {
            id: true,
            fullName: true,
            username: true,
            email: true,
          },
        },
        followers: {
          select: {
            id: true,
            fullName: true,
            username: true,
            email: true,
          },
        },
        comments: {
          include: {
            author: {
              select: {
                id: true,
                fullName: true,
                username: true,
                email: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    if (user) {
      const isCreator = task.createdById === user.id;
      const isAssignee = task.assignees.some(a => a.id === user.id);
      const isFollower = task.followers.some(f => f.id === user.id);

      if (!isCreator && !isAssignee && !isFollower) {
        throw new NotFoundException(`Task with ID ${id} not found`);
      }
    }

    // Retrieve storage files linked to this Task
    const attachments = await this.prisma.storageFile.findMany({
      where: {
        entityId: id,
        entityType: 'TASK',
      },
      select: {
        id: true,
        filename: true,
        size: true,
        mimeType: true,
        driver: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Retrieve storage files linked to comments
    const commentIds = task.comments.map(c => c.id);
    const commentAttachments = commentIds.length > 0
      ? await this.prisma.storageFile.findMany({
          where: {
            entityId: { in: commentIds },
            entityType: 'COMMENT',
          },
          select: {
            id: true,
            filename: true,
            size: true,
            mimeType: true,
            driver: true,
            entityId: true,
            createdAt: true,
          },
        })
      : [];

    const commentsWithAttachments = task.comments.map(comment => ({
      ...comment,
      attachments: commentAttachments.filter(att => att.entityId === comment.id),
    }));

    return {
      ...task,
      comments: commentsWithAttachments,
      attachments,
    };
  }

  async create(dto: CreateTaskDto, creatorId: string) {
    const data: any = {
      title: dto.templateId ? replaceDatePlaceholders(dto.title) : dto.title,
      description: dto.description || '',
      status: dto.status || 'NOT_STARTED',
      priority: dto.priority || 'MEDIUM',
      taskType: dto.taskType || 'TASK',
      createdById: creatorId,
      checklist: dto.checklist || [],
      templateId: dto.templateId || null,
    };

    if (dto.dueDate) {
      data.dueDate = new Date(dto.dueDate);
    }

    const assigneeIds = dto.assigneeIds || (dto.assigneeId ? [dto.assigneeId] : []);
    if (assigneeIds.length > 0) {
      data.assignees = {
        connect: assigneeIds.map(fid => ({ id: fid }))
      };
      data.assigneeId = assigneeIds[0];
    }

    if (dto.followers && dto.followers.length > 0) {
      data.followers = {
        connect: dto.followers.map(fid => ({ id: fid }))
      };
    }

    const task = await this.prisma.task.create({
      data,
      include: {
        template: {
          select: {
            id: true,
            templateName: true,
          },
        },
        assignee: {
          select: {
            id: true,
            fullName: true,
            username: true,
          },
        },
        assignees: {
          select: {
            id: true,
            fullName: true,
            username: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            fullName: true,
            username: true,
          },
        },
      },
    });

    try {
      await this.auditService.log(creatorId, 'CREATE_TASK', 'Task', task.id, {
        title: task.title,
        templateId: dto.templateId || null,
      });
    } catch (err) {
      // Safe catch
    }

    const frontendUrl = process.env.FRONTEND_URL || 'https://yato.honet.web.id';
    const taskUrl = `${frontendUrl}/tasks?taskId=${task.id}`;

    // Notify assignees
    if (assigneeIds.length > 0) {
      for (const aid of assigneeIds) {
        try {
          await this.notificationService.sendToUserQueue(
            aid,
            `Task Assigned to You`,
            `You have been assigned to task <b>${task.title}</b>.\n\nLink: ${taskUrl}`,
          );
        } catch (err) {
          // Safe catch
        }
      }
    }

    // Notify followers
    if (dto.followers && dto.followers.length > 0) {
      for (const fid of dto.followers) {
        try {
          await this.notificationService.sendToUserQueue(
            fid,
            `Task Follower Added`,
            `You have been added as a follower to task <b>${task.title}</b>.\n\nLink: ${taskUrl}`,
          );
        } catch (err) {
          // Safe catch
        }
      }
    }

    return task;
  }

  async update(id: string, dto: UpdateTaskDto, updaterId: string) {
    // Ensure task exists
    const existingTask = await this.prisma.task.findUnique({
      where: { id },
      include: { followers: true, assignees: true }
    });
    if (!existingTask) throw new NotFoundException('Task not found');

    const data: any = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.taskType !== undefined) data.taskType = dto.taskType;
    if (dto.checklist !== undefined) data.checklist = dto.checklist;
    if (dto.templateId !== undefined) data.templateId = dto.templateId;
    
    if (dto.dueDate !== undefined) {
      data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    }

    if (dto.assigneeIds !== undefined) {
      data.assignees = {
        set: dto.assigneeIds.map(fid => ({ id: fid }))
      };
      data.assigneeId = dto.assigneeIds[0] || null;
    } else if (dto.assigneeId !== undefined) {
      data.assignees = {
        set: dto.assigneeId ? [{ id: dto.assigneeId }] : []
      };
      data.assigneeId = dto.assigneeId || null;
    }

    // Track auditor updates
    data.updatedById = updaterId;

    if (dto.followers !== undefined) {
      data.followers = {
        set: dto.followers.map(fid => ({ id: fid }))
      };
    }

    const updatedTask = await this.prisma.task.update({
      where: { id },
      data,
      include: {
        template: {
          select: {
            id: true,
            templateName: true,
          },
        },
        assignee: {
          select: {
            id: true,
            fullName: true,
            username: true,
          },
        },
        assignees: {
          select: {
            id: true,
            fullName: true,
            username: true,
            email: true,
          },
        },
        updatedBy: {
          select: {
            id: true,
            fullName: true,
            username: true,
          },
        },
        followers: {
          select: {
            id: true,
            fullName: true,
            username: true,
          },
        },
      },
    });

    try {
      await this.auditService.log(updaterId, 'UPDATE_TASK', 'Task', updatedTask.id, {
        dto,
      });
    } catch (err) {
      // Safe catch
    }

    const frontendUrl = process.env.FRONTEND_URL || 'https://yato.honet.web.id';
    const taskUrl = `${frontendUrl}/tasks?taskId=${updatedTask.id}`;

    // Notify any new assignees
    if (dto.assigneeIds !== undefined) {
      const existingAssigneeIds = existingTask.assignees.map(a => a.id);
      const newAssignees = dto.assigneeIds.filter(aid => !existingAssigneeIds.includes(aid));
      for (const aid of newAssignees) {
        try {
          await this.notificationService.sendToUserQueue(
            aid,
            `Task Assigned to You`,
            `You have been assigned to task <b>${updatedTask.title}</b>.\n\nLink: ${taskUrl}`,
          );
        } catch (err) {
          // Safe catch
        }
      }
    }

    // Notify any new followers
    if (dto.followers !== undefined) {
      const existingFollowerIds = existingTask.followers.map(f => f.id);
      const newFollowers = dto.followers.filter(fid => !existingFollowerIds.includes(fid));
      for (const fid of newFollowers) {
        try {
          await this.notificationService.sendToUserQueue(
            fid,
            `Task Follower Added`,
            `You have been added as a follower to task <b>${updatedTask.title}</b>.\n\nLink: ${taskUrl}`,
          );
        } catch (err) {
          // Safe catch
        }
      }
    }

    return updatedTask;
  }

  async delete(id: string, userId?: string) {
    const task = await this.findOne(id);
    const deletedTask = await this.prisma.task.delete({
      where: { id },
    });
    if (userId) {
      try {
        await this.auditService.log(userId, 'DELETE_TASK', 'Task', id, {
          title: task.title,
        });
      } catch (err) {
        // Safe catch
      }
    }
    return deletedTask;
  }

  async createComment(taskId: string, dto: CreateTaskCommentDto, authorId: string) {
    await this.findOne(taskId);

    const comment = await this.prisma.taskComment.create({
      data: {
        content: dto.content,
        taskId,
        authorId,
        parentId: dto.parentId || null,
      },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            username: true,
            email: true,
          },
        },
      },
    });

    // Handle comment attachments
    if (dto.attachments && dto.attachments.length > 0) {
      const base64Urls = dto.attachments.map(att => {
        // Embed the filename in the base64 URL so uploadFile extracts it!
        // Format: data:mime/type;name=encodedName;base64,payload
        const parts = att.base64Data.split(';base64,');
        if (parts.length === 2 && parts[0].startsWith('data:')) {
          const mime = parts[0];
          const nameParam = `;name=${encodeURIComponent(att.filename)}`;
          return `${mime}${nameParam};base64,${parts[1]}`;
        }
        return att.base64Data;
      });

      await this.storageService.processAttachments(
        base64Urls,
        authorId,
        comment.id,
        'COMMENT'
      );
    }

    // Retrieve final attachments for this comment
    const attachments = await this.prisma.storageFile.findMany({
      where: {
        entityId: comment.id,
        entityType: 'COMMENT',
      },
      select: {
        id: true,
        filename: true,
        size: true,
        mimeType: true,
        driver: true,
        createdAt: true,
      },
    });

    // Mention Detection Logic in TaskComment
    try {
      const mentionRegex = /@([^\s,.:;!?"'()\[\]{}]+)/g;
      const matches = [...dto.content.matchAll(mentionRegex)];
      const mentionedUserIds = new Set<string>();

      const task = await this.prisma.task.findUnique({
        where: { id: taskId },
        include: { followers: true, assignees: true }
      });

      if (task) {
        const frontendUrl = process.env.FRONTEND_URL || 'https://yato.honet.web.id';
        const taskUrl = `${frontendUrl}/tasks?taskId=${task.id}`;

        if (matches.length > 0) {
          const usernames = matches.map(m => m[1]);
          const mentionedUsers = await this.prisma.user.findMany({
            where: {
              OR: [
                { username: { in: usernames, mode: 'insensitive' } },
                { fullName: { in: usernames, mode: 'insensitive' } }
              ]
            },
            select: { id: true, fullName: true }
          });

          for (const user of mentionedUsers) {
            if (user.id !== authorId) {
              mentionedUserIds.add(user.id);
              await this.notificationService.sendToUserQueue(
                user.id,
                `You were mentioned in a Task`,
                `<b>${comment.author.fullName}</b> mentioned you in a comment on task <b>${task.title}</b>: "${dto.content}"\n\nLink: ${taskUrl}`,
              );
            }
          }
        }

        // Notify other followers / assignees / creator who were not mentioned
        const receiverIds = new Set([
          ...task.followers.map(f => f.id),
          ...task.assignees.map(a => a.id),
          task.createdById
        ].filter(uid => uid && uid !== authorId && !mentionedUserIds.has(uid)));

        for (const uid of receiverIds) {
          await this.notificationService.sendToUserQueue(
            uid,
            `New Comment on Task: ${task.title}`,
            `<b>${comment.author.fullName}</b> commented on task <b>${task.title}</b>: "${dto.content}"\n\nLink: ${taskUrl}`,
          );
        }
      }
    } catch (err) {
      // Safe catch
    }

    return {
      ...comment,
      attachments,
    };
  }

  async addAttachment(taskId: string, base64Data: string, filename: string, uploaderId: string) {
    // Embed the filename in the base64 URL so uploadFile extracts it!
    let base64WithFilename = base64Data;
    const parts = base64Data.split(';base64,');
    if (parts.length === 2 && parts[0].startsWith('data:')) {
      const mime = parts[0];
      const nameParam = `;name=${encodeURIComponent(filename)}`;
      base64WithFilename = `${mime}${nameParam};base64,${parts[1]}`;
    }

    // Process single attachment with correct argument ordering
    const fileUrls = await this.storageService.processAttachments(
      [base64WithFilename],
      uploaderId,
      taskId,
      'TASK'
    );

    return { fileUrl: fileUrls[0] };
  }

  async removeAttachment(fileId: string) {
    return this.storageService.deleteFile(fileId);
  }

  async findAllTemplates(userId: string) {
    return this.prisma.taskTemplate.findMany({
      where: { createdById: userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneTemplate(id: string, userId?: string) {
    const template = await this.prisma.taskTemplate.findUnique({
      where: { id },
    });
    if (!template) {
      throw new NotFoundException(`Task template with ID ${id} not found`);
    }
    if (userId && template.createdById !== userId) {
      throw new NotFoundException(`Task template with ID ${id} not found`);
    }
    return template;
  }

  async createTemplate(dto: CreateTaskTemplateDto, creatorId: string) {
    const template = await this.prisma.taskTemplate.create({
      data: {
        templateName: dto.templateName,
        title: dto.title,
        description: dto.description || '',
        priority: dto.priority || 'MEDIUM',
        taskType: dto.taskType || 'TASK',
        checklist: dto.checklist || [],
        repeatInterval: dto.repeatInterval || 'NONE',
        repeatTime: dto.repeatTime || null,
        repeatDayOfWeek: dto.repeatDayOfWeek !== undefined ? Number(dto.repeatDayOfWeek) : null,
        repeatDayOfMonth: dto.repeatDayOfMonth !== undefined ? Number(dto.repeatDayOfMonth) : null,
        createdById: creatorId,
      },
    });
    try {
      await this.auditService.log(creatorId, 'CREATE_TEMPLATE', 'TaskTemplate', template.id, {
        templateName: template.templateName,
      });
    } catch (err) {
      // Safe catch
    }
    return template;
  }

  async updateTemplate(id: string, dto: UpdateTaskTemplateDto, userId: string) {
    await this.findOneTemplate(id, userId);

    const data: any = {};
    if (dto.templateName !== undefined) data.templateName = dto.templateName;
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.taskType !== undefined) data.taskType = dto.taskType;
    if (dto.checklist !== undefined) data.checklist = dto.checklist;
    if (dto.repeatInterval !== undefined) data.repeatInterval = dto.repeatInterval;
    if (dto.repeatTime !== undefined) data.repeatTime = dto.repeatTime;
    if (dto.repeatDayOfWeek !== undefined) data.repeatDayOfWeek = dto.repeatDayOfWeek !== null ? Number(dto.repeatDayOfWeek) : null;
    if (dto.repeatDayOfMonth !== undefined) data.repeatDayOfMonth = dto.repeatDayOfMonth !== null ? Number(dto.repeatDayOfMonth) : null;

    const template = await this.prisma.taskTemplate.update({
      where: { id },
      data,
    });
    try {
      await this.auditService.log(userId, 'UPDATE_TEMPLATE', 'TaskTemplate', id, {
        templateName: template.templateName,
        dto,
      });
    } catch (err) {
      // Safe catch
    }
    return template;
  }

  async deleteTemplate(id: string, userId: string) {
    const template = await this.findOneTemplate(id, userId);
    const deleted = await this.prisma.taskTemplate.delete({
      where: { id },
    });
    try {
      await this.auditService.log(userId, 'DELETE_TEMPLATE', 'TaskTemplate', id, {
        templateName: template.templateName,
      });
    } catch (err) {
      // Safe catch
    }
    return deleted;
  }
}
