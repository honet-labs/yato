import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RoleService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.role.findMany({
      include: {
        _count: {
          select: { users: true }
        }
      }
    });
  }

  async findByName(name: string) {
    return this.prisma.role.findUnique({ where: { name } });
  }

  async create(data: any) {
    return this.prisma.role.create({ data });
  }

  async update(id: string, data: any) {
    return this.prisma.role.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return this.prisma.role.delete({ where: { id } });
  }

  getAvailablePermissions() {
    return [
      "VIEW_DASHBOARD",
      "VIEW_SUPPORT_TICKETS",
      "MANAGE_SUPPORT_TICKETS",
      "APPROVE_REQUESTS",
      "VIEW_VM_INVENTORY",
      "PROVISION_VM",
      "MANAGE_VM_INVENTORY",
      "VIEW_SERVICE_INVENTORY",
      "PROVISION_SERVICE",
      "MANAGE_SERVICE_INVENTORY",
      "VIEW_CREDENTIALS",
      "MANAGE_CREDENTIALS",
      "VIEW_ASSETS",
      "MANAGE_ASSETS",
      "VIEW_AUDIT_LOGS",
      "VIEW_SYSTEM_STATUS",
      "MANAGE_USERS",
      "MANAGE_ROLES",
      "MANAGE_CONFIG",
      "VIEW_TASKS",
      "MANAGE_TASKS",
      "VIEW_FILES",
      "MANAGE_FILES",
      "VIEW_HRM",
      "MANAGE_HRM",
      "VIEW_HRM_ADMIN_PANEL",
      "MANAGE_HRM_ATTENDANCE",
      "MANAGE_HRM_LEAVES",
      "MANAGE_HRM_DIVISIONS",
      "MANAGE_HRM_SCHEDULER",
      "MANAGE_HRM_ADJUSTMENTS",
      "VIEW_PMO_CALENDAR",
      "MANAGE_PMO_CALENDAR"
    ];
  }
}
