import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PmoService {
  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // PROJECT OPERATIONS
  // ==========================================

  async findAllProjects() {
    return this.prisma.project.findMany({
      include: {
        tasks: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true,
            startDate: true,
            assignee: {
              select: {
                id: true,
                fullName: true,
                username: true,
              },
            },
          },
        },
        milestones: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOneProject(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        tasks: true,
        milestones: true,
      },
    });
    if (!project) throw new NotFoundException(`Project with ID ${id} not found`);
    return project;
  }

  async createProject(data: { name: string; description?: string; startDate: string; endDate: string; status?: string; colorCode?: string }) {
    return this.prisma.project.create({
      data: {
        name: data.name,
        description: data.description,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        status: data.status || 'PLANNING',
        colorCode: data.colorCode || '#4F46E5',
      },
    });
  }

  async updateProject(id: string, data: { name?: string; description?: string; startDate?: string; endDate?: string; status?: string; colorCode?: string }) {
    await this.findOneProject(id);
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
    if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate);
    if (data.status !== undefined) updateData.status = data.status;
    if (data.colorCode !== undefined) updateData.colorCode = data.colorCode;

    return this.prisma.project.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteProject(id: string) {
    await this.findOneProject(id);
    return this.prisma.project.delete({
      where: { id },
    });
  }

  // ==========================================
  // MILESTONE OPERATIONS
  // ==========================================

  async findAllMilestones() {
    return this.prisma.milestone.findMany({
      include: {
        project: {
          select: {
            id: true,
            name: true,
            colorCode: true,
          },
        },
      },
      orderBy: {
        dueDate: 'asc',
      },
    });
  }

  async findOneMilestone(id: string) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id },
    });
    if (!milestone) throw new NotFoundException(`Milestone with ID ${id} not found`);
    return milestone;
  }

  async createMilestone(data: { projectId: string; title: string; description?: string; dueDate: string; isReached?: boolean }) {
    // Validate project exists
    await this.findOneProject(data.projectId);
    return this.prisma.milestone.create({
      data: {
        projectId: data.projectId,
        title: data.title,
        description: data.description,
        dueDate: new Date(data.dueDate),
        isReached: data.isReached ?? false,
      },
    });
  }

  async updateMilestone(id: string, data: { title?: string; description?: string; dueDate?: string; isReached?: boolean }) {
    await this.findOneMilestone(id);
    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.dueDate !== undefined) updateData.dueDate = new Date(data.dueDate);
    if (data.isReached !== undefined) updateData.isReached = data.isReached;

    return this.prisma.milestone.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteMilestone(id: string) {
    await this.findOneMilestone(id);
    return this.prisma.milestone.delete({
      where: { id },
    });
  }

  // ==========================================
  // CALENDAR NOTE OPERATIONS
  // ==========================================

  async findAllCalendarNotes(userId: string) {
    return this.prisma.calendarNote.findMany({
      where: { userId },
      orderBy: {
        targetDate: 'asc',
      },
    });
  }

  async findOneCalendarNote(id: string, userId: string) {
    const note = await this.prisma.calendarNote.findUnique({
      where: { id },
    });
    if (!note) throw new NotFoundException(`Calendar note with ID ${id} not found`);
    if (note.userId !== userId) throw new NotFoundException(`Calendar note with ID ${id} not found`);
    return note;
  }

  async createCalendarNote(userId: string, data: { targetDate: string; title: string; content?: string; category?: string }) {
    return this.prisma.calendarNote.create({
      data: {
        userId,
        targetDate: new Date(data.targetDate),
        title: data.title,
        content: data.content,
        category: data.category || 'GENERAL',
      },
    });
  }

  async updateCalendarNote(id: string, userId: string, data: { title?: string; content?: string; category?: string; targetDate?: string }) {
    await this.findOneCalendarNote(id, userId);
    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.targetDate !== undefined) updateData.targetDate = new Date(data.targetDate);

    return this.prisma.calendarNote.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteCalendarNote(id: string, userId: string) {
    await this.findOneCalendarNote(id, userId);
    return this.prisma.calendarNote.delete({
      where: { id },
    });
  }
}
