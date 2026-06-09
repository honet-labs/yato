import { Injectable, BadRequestException, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class HrmService {
  private readonly logger = new Logger(HrmService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly auditService: AuditService,
  ) {}

  // =========================================================================
  // 1. DIVISIONS & ORG STRUCTURE
  // =========================================================================

  async listDivisions() {
    return this.prisma.division.findMany({
      include: {
        supervisor: { select: { id: true, fullName: true, email: true } },
        manager: { select: { id: true, fullName: true, email: true } },
        head: { select: { id: true, fullName: true, email: true } },
        _count: { select: { users: true } },
      },
    });
  }

  async createDivision(actorId: string, data: { name: string; description?: string; supervisorId?: string; managerId?: string; headId?: string }) {
    this.logger.log(`Creating division: "${data.name}" by user ${actorId}`);
    const cleanedData = {
      ...data,
      supervisorId: data.supervisorId === "" ? null : data.supervisorId || null,
      managerId: data.managerId === "" ? null : data.managerId || null,
      headId: data.headId === "" ? null : data.headId || null,
    };
    try {
      const division = await this.prisma.division.create({ data: cleanedData });
      this.logger.log(`Successfully created division ${division.id} ("${division.name}")`);
      await this.auditService.log(actorId, 'CREATE_DIVISION', 'Division', division.id, { name: data.name });
      return division;
    } catch (err) {
      this.logger.error(`Failed to create division "${data.name}": ${err.message}`, err.stack);
      throw err;
    }
  }

  async updateDivision(actorId: string, id: string, data: { name?: string; description?: string; supervisorId?: string; managerId?: string; headId?: string }) {
    this.logger.log(`Updating division ${id} by user ${actorId}. Keys: ${Object.keys(data).join(', ')}`);
    const cleanedData = {
      ...data,
      supervisorId: data.supervisorId === "" ? null : data.supervisorId,
      managerId: data.managerId === "" ? null : data.managerId,
      headId: data.headId === "" ? null : data.headId,
    };
    try {
      const division = await this.prisma.division.update({
        where: { id },
        data: cleanedData,
      });
      this.logger.log(`Successfully updated division ${id} ("${division.name}")`);
      await this.auditService.log(actorId, 'UPDATE_DIVISION', 'Division', id, data);
      return division;
    } catch (err) {
      this.logger.error(`Failed to update division ${id}: ${err.message}`, err.stack);
      throw err;
    }
  }

  // =========================================================================
  // 2. SHIFT CATEGORIES & ROSTER
  // =========================================================================

  async listShiftCategories() {
    return this.prisma.shiftCategory.findMany();
  }

  async createShiftCategory(actorId: string, data: {
    name: string;
    startTime: string;
    endTime: string;
    breakStart: string;
    breakEnd: string;
    colorCode?: string;
    description?: string;
  }) {
    this.logger.log(`Creating shift category: "${data.name}" (${data.startTime} - ${data.endTime}) by user ${actorId}`);
    try {
      const category = await this.prisma.shiftCategory.create({ data });
      this.logger.log(`Successfully created shift category ${category.id} ("${category.name}")`);
      await this.auditService.log(actorId, 'CREATE_SHIFT_CATEGORY', 'ShiftCategory', category.id, { name: data.name });
      return category;
    } catch (err) {
      this.logger.error(`Failed to create shift category "${data.name}": ${err.message}`, err.stack);
      throw err;
    }
  }

  async updateShiftCategory(actorId: string, id: string, data: {
    name?: string;
    startTime?: string;
    endTime?: string;
    breakStart?: string;
    breakEnd?: string;
    colorCode?: string;
    description?: string;
  }) {
    this.logger.log(`Updating shift category ${id} by user ${actorId}. Keys: ${Object.keys(data).join(', ')}`);
    try {
      const category = await this.prisma.shiftCategory.update({
        where: { id },
        data,
      });
      this.logger.log(`Successfully updated shift category ${id} ("${category.name}")`);
      await this.auditService.log(actorId, 'UPDATE_SHIFT_CATEGORY', 'ShiftCategory', id, data);
      return category;
    } catch (err) {
      this.logger.error(`Failed to update shift category ${id}: ${err.message}`, err.stack);
      throw err;
    }
  }

  async deleteShiftCategory(actorId: string, id: string) {
    this.logger.log(`Deleting shift category ${id} by user ${actorId}`);
    try {
      // Delete all work shifts using this shift category
      const deletedShifts = await this.prisma.workShift.deleteMany({
        where: { shiftCategoryId: id },
      });
      this.logger.log(`Deleted ${deletedShifts.count} associated work shifts for shift category ${id}`);
      
      const category = await this.prisma.shiftCategory.delete({
        where: { id },
      });
      this.logger.log(`Successfully deleted shift category ${id} ("${category.name}")`);
      await this.auditService.log(actorId, 'DELETE_SHIFT_CATEGORY', 'ShiftCategory', id);
      return category;
    } catch (err) {
      this.logger.error(`Failed to delete shift category ${id}: ${err.message}`, err.stack);
      throw err;
    }
  }

  async assignShift(actorId: string, data: { userId: string; shiftCategoryId: string; date: string; notes?: string }) {
    this.logger.log(`Assigning shift category ${data.shiftCategoryId} to user ${data.userId} on date ${data.date} by user ${actorId}`);
    const shiftDate = new Date(data.date);
    // Set to midnight UTC/local to ensure date matching is consistent
    shiftDate.setUTCHours(0, 0, 0, 0);

    try {
      const shift = await this.prisma.workShift.upsert({
        where: {
          userId_date: {
            userId: data.userId,
            date: shiftDate,
          },
        },
        update: {
          shiftCategoryId: data.shiftCategoryId,
          notes: data.notes,
        },
        create: {
          userId: data.userId,
          shiftCategoryId: data.shiftCategoryId,
          date: shiftDate,
          notes: data.notes,
        },
      });
      this.logger.log(`Successfully assigned shift ${shift.id} to user ${data.userId}`);
      await this.auditService.log(actorId, 'ASSIGN_SHIFT', 'WorkShift', shift.id, { userId: data.userId, date: data.date });
      return shift;
    } catch (err) {
      this.logger.error(`Failed to assign shift to user ${data.userId}: ${err.message}`, err.stack);
      throw err;
    }
  }

  async getRoster(userId: string, start: string, end: string) {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return this.prisma.workShift.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        shiftCategory: true,
      },
      orderBy: { date: 'asc' },
    });
  }

  // =========================================================================
  // 3. CLOCK-IN / CLOCK-OUT & TIMESHEET
  // =========================================================================

  async clockIn(
    userId: string,
    ipAddress: string,
    device: string,
    latenessReason?: string,
    customTime?: Date, // For flexible simulation or testing
    selfie?: string
  ) {
    this.logger.log(`Clock-in attempt by user ${userId} from IP ${ipAddress} (${device})`);
    const now = customTime || new Date();
    const todayMidnight = new Date(now);
    todayMidnight.setHours(0, 0, 0, 0);

    try {
      // 1. IP White-listing Check (Anti-Fraud)
      // Query corporate white-listed IP configs
      const whitelistConfigs = await this.prisma.systemSetting.findMany({
        where: { key: { in: ['office_ip_whitelist', 'office_ip_enabled'] } },
      });

      const isEnabled = whitelistConfigs.find(c => c.key === 'office_ip_enabled')?.value === 'true';
      const whitelistVal = whitelistConfigs.find(c => c.key === 'office_ip_whitelist')?.value;
      const allowedIps = typeof whitelistVal === 'string' ? whitelistVal.split(',').map(ip => ip.trim()) : [];

      if (isEnabled && allowedIps.length > 0 && !allowedIps.includes(ipAddress)) {
        this.logger.warn(`Clock-in blocked: IP ${ipAddress} not white-listed for user ${userId}`);
        throw new ForbiddenException(`Access Blocked: IP Address ${ipAddress} is not registered in corporate white-listing!`);
      }

      // 2. Create or fetch Timesheet for today (No Shift/Scheduler Dependency)
      let timesheet = await this.prisma.timesheet.findFirst({
        where: {
          userId,
          date: {
            gte: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0),
            lte: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59),
          },
        },
      });

      if (!timesheet) {
        timesheet = await this.prisma.timesheet.create({
          data: {
            userId,
            date: now,
            status: 'PRESENT',
            latenessReason: null,
          },
        });
        this.logger.log(`Created new timesheet ${timesheet.id} for user ${userId}`);
      }

      let selfieUrl: string | undefined = undefined;
      if (selfie) {
        try {
          const fileRecord = await this.storageService.uploadFile(
            selfie,
            userId,
            timesheet.id,
            'TIMESHEET_LOG',
          );
          selfieUrl = `/api/storage/download/${fileRecord.id}`;
          this.logger.log(`Uploaded selfie for clock-in: file ${fileRecord.id}`);
        } catch (error) {
          this.logger.error(`Selfie upload failed during clock-in for user ${userId}: ${error.message}`);
        }
      }

      // 5. Append Clock-in log
      await this.prisma.timesheetLog.create({
        data: {
          timesheetId: timesheet.id,
          type: 'CHECK_IN',
          timestamp: now,
          ipAddress,
          device,
          selfieUrl,
        },
      });

      this.logger.log(`User ${userId} clocked in successfully at ${now.toISOString()}`);
      await this.auditService.log(userId, 'CLOCK_IN', 'Timesheet', timesheet.id, { ipAddress, device });
      return {
        message: 'Successfully clocked in!',
        status: timesheet.status,
        timestamp: now,
      };
    } catch (err) {
      this.logger.error(`Clock-in failed for user ${userId}: ${err.message}`, err.stack);
      throw err;
    }
  }

  async clockOut(userId: string, ipAddress: string, device: string, notes?: string, customTime?: Date, selfie?: string) {
    this.logger.log(`Clock-out attempt by user ${userId} from IP ${ipAddress} (${device})`);
    const now = customTime || new Date();

    try {
      const timesheet = await this.prisma.timesheet.findFirst({
        where: {
          userId,
          date: {
            gte: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0),
            lte: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59),
          },
        },
        include: { logs: true },
      });

      if (!timesheet) {
        this.logger.warn(`Clock-out failed: user ${userId} has no active timesheet today`);
        throw new BadRequestException('Clock-out failed: You have not clocked in yet today.');
      }

      let selfieUrl: string | undefined = undefined;
      if (selfie) {
        try {
          const fileRecord = await this.storageService.uploadFile(
            selfie,
            userId,
            timesheet.id,
            'TIMESHEET_LOG',
          );
          selfieUrl = `/api/storage/download/${fileRecord.id}`;
          this.logger.log(`Uploaded selfie for clock-out: file ${fileRecord.id}`);
        } catch (error) {
          this.logger.error(`Selfie upload failed during clock-out for user ${userId}: ${error.message}`);
        }
      }

      // Append Clock-out log
      await this.prisma.timesheetLog.create({
        data: {
          timesheetId: timesheet.id,
          type: 'CHECK_OUT',
          timestamp: now,
          ipAddress,
          device,
          selfieUrl,
        },
      });

      // Re-fetch with the newly added check-out log to calculate total hours worked
      const updatedTimesheet = await this.prisma.timesheet.findUnique({
        where: { id: timesheet.id },
        include: { logs: { orderBy: { timestamp: 'asc' } } },
      });

      // Calculate accumulation of check-in and check-out pairs
      let totalMs = 0;
      let lastCheckIn: Date | null = null;

    for (const log of updatedTimesheet.logs) {
      if (log.type === 'CHECK_IN') {
        lastCheckIn = new Date(log.timestamp);
      } else if (log.type === 'CHECK_OUT' && lastCheckIn) {
        totalMs += new Date(log.timestamp).getTime() - lastCheckIn.getTime();
        lastCheckIn = null;
      }
    }

    const totalHours = Number((totalMs / (1000 * 60 * 60)).toFixed(2));

    await this.prisma.timesheet.update({
      where: { id: timesheet.id },
      data: {
        totalHours,
        notes: notes || timesheet.notes,
      },
    });

    await this.auditService.log(userId, 'CLOCK_OUT', 'Timesheet', timesheet.id, { ipAddress, device, totalHours });
    return {
      message: 'Successfully clocked out!',
      totalHours,
      timestamp: now,
    };
  }

  async getMyTimesheets(userId: string, year: number, month: number) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);

    return this.prisma.timesheet.findMany({
      where: {
        userId,
        date: { gte: start, lte: end },
      },
      include: {
        logs: { orderBy: { timestamp: 'asc' } },
      },
      orderBy: { date: 'asc' },
    });
  }

  async getAllTimesheets(dateStr: string) {
    const targetDate = new Date(dateStr);
    const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
    const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59);

    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        fullName: true,
        email: true,
        division: { select: { name: true } },
      },
      orderBy: { fullName: 'asc' },
    });

    const timesheets = await this.prisma.timesheet.findMany({
      where: {
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        logs: { orderBy: { timestamp: 'asc' } },
      },
    });

    return users.map(user => {
      const ts = timesheets.find(t => t.userId === user.id);
      return {
        user,
        timesheet: ts || null,
      };
    });
  }

  async getDivisionTimesheets(divisionId: string, dateStr: string) {
    const targetDate = new Date(dateStr);
    return this.prisma.timesheet.findMany({
      where: {
        user: { divisionId },
        date: {
          gte: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0),
          lte: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59),
        },
      },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        logs: true,
      },
    });
  }

  // =========================================================================
  // 4. ADMIN ADJUSTMENTS
  // =========================================================================

  async adjustAttendance(data: {
    timesheetId: string;
    adminId: string;
    changedFrom: string;
    changedTo: string;
    reason: string;
    newTotalHours: number;
    newStatus?: string;
  }) {
    this.logger.log(`Admin ${data.adminId} adjusting timesheet ${data.timesheetId}. From: ${data.changedFrom}, To: ${data.changedTo}, Reason: "${data.reason}"`);
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. Record the adjustment audit log
        await tx.attendanceAdjustmentLog.create({
          data: {
            timesheetId: data.timesheetId,
            adminId: data.adminId,
            changedFrom: data.changedFrom,
            changedTo: data.changedTo,
            reason: data.reason,
          },
        });

        // 2. Update the actual timesheet record
        return tx.timesheet.update({
          where: { id: data.timesheetId },
          data: {
            totalHours: data.newTotalHours,
            status: data.newStatus || undefined,
          },
        });
      });
      this.logger.log(`Successfully completed attendance adjustment for timesheet ${data.timesheetId}`);
      await this.auditService.log(data.adminId, 'ADJUST_ATTENDANCE', 'Timesheet', data.timesheetId, { changedFrom: data.changedFrom, changedTo: data.changedTo, reason: data.reason });
      return result;
    } catch (err) {
      this.logger.error(`Failed to adjust attendance for timesheet ${data.timesheetId}: ${err.message}`, err.stack);
      throw err;
    }
  }

  // =========================================================================
  // 5. LEAVE REQUESTS (Multi-Level Approval & Auto-Deduct)
  // =========================================================================

  async getLeaveBalance(userId: string, year: number) {
    let balance = await this.prisma.leaveBalance.findUnique({
      where: { userId },
    });

    if (!balance) {
      balance = await this.prisma.leaveBalance.create({
        data: {
          userId,
          allocated: 12,
          used: 0,
          remaining: 12,
          year,
        },
      });
    }

    return balance;
  }

  async requestLeave(userId: string, data: { type: string; startDate: string; endDate: string; reason: string; attachments?: string[] }) {
    this.logger.log(`User ${userId} requesting leave (${data.type}) from ${data.startDate} to ${data.endDate}`);
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);

    const durationDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    try {
      // 1. Check leave balance for ANNUAL_LEAVE
      if (data.type === 'ANNUAL_LEAVE') {
        const balance = await this.getLeaveBalance(userId, start.getFullYear());
        if (balance.remaining < durationDays) {
          this.logger.warn(`User ${userId} leave request rejected: insufficient balance. Requested ${durationDays}, remaining ${balance.remaining}`);
          throw new BadRequestException(`Insufficient leave quota. Requested: ${durationDays} days, Available: ${balance.remaining} days.`);
        }
      }

      // 2. Fetch user's division hierarchy for routing approvals
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          division: true,
        },
      });

      // 3. Create the Leave Request
      const request = await this.prisma.$transaction(async (tx) => {
        const req = await tx.leaveRequest.create({
          data: {
            userId,
            type: data.type,
            startDate: start,
            endDate: end,
            reason: data.reason,
            attachments: data.attachments || [],
          },
        });

        // 4. Seed approval steps based on division managers/supervisors
        const approvalsToCreate = [];
        
        if (user.division) {
          if (user.division.supervisorId) {
            approvalsToCreate.push({
              leaveRequestId: req.id,
              level: 1,
              roleName: 'SUPERVISOR',
              status: 'PENDING',
            });
          }

          if (user.division.managerId) {
            approvalsToCreate.push({
              leaveRequestId: req.id,
              level: 2,
              roleName: 'MANAGER',
              status: 'PENDING',
            });
          }

          if (user.division.headId) {
            approvalsToCreate.push({
              leaveRequestId: req.id,
              level: 3,
              roleName: 'DEPT_HEAD',
              status: 'PENDING',
            });
          }
        }

        // If no supervisors/managers configured, auto-approve
        if (approvalsToCreate.length === 0) {
          this.logger.log(`No supervisors/managers configured for division. Leave request ${req.id} auto-approved.`);
          await tx.leaveRequest.update({
            where: { id: req.id },
            data: { status: 'APPROVED' },
          });

          if (data.type === 'ANNUAL_LEAVE') {
            await tx.leaveBalance.update({
              where: { userId },
              data: {
                used: { increment: durationDays },
                remaining: { decrement: durationDays },
              },
            });
          }
        } else {
          await tx.leaveApproval.createMany({
            data: approvalsToCreate,
          });
          this.logger.log(`Leave request ${req.id} created with ${approvalsToCreate.length} approval levels.`);
        }

        return req;
      });

      this.logger.log(`Successfully completed leave request registration for user ${userId}: request ${request.id}`);
      await this.auditService.log(userId, 'REQUEST_LEAVE', 'LeaveRequest', request.id, { type: data.type, startDate: data.startDate, endDate: data.endDate });
      return request;
    } catch (err) {
      this.logger.error(`Failed to request leave for user ${userId}: ${err.message}`, err.stack);
      throw err;
    }
  }

  async getMyLeaves(userId: string) {
    return this.prisma.leaveRequest.findMany({
      where: { userId },
      include: {
        user: {
          include: {
            division: true,
          },
        },
        approvals: {
          include: {
            approver: {
              select: {
                fullName: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }


  async getPendingApprovals(approverId: string) {
    // A user can approve if they are mapped as SPV, Manager, or Head in a division
    const divisions = await this.prisma.division.findMany({
      where: {
        OR: [
          { supervisorId: approverId },
          { managerId: approverId },
          { headId: approverId },
        ],
      },
    });

    const rolesMap: { [divId: string]: string[] } = {};
    divisions.forEach(d => {
      rolesMap[d.id] = [];
      if (d.supervisorId === approverId) rolesMap[d.id].push('SUPERVISOR');
      if (d.managerId === approverId) rolesMap[d.id].push('MANAGER');
      if (d.headId === approverId) rolesMap[d.id].push('DEPT_HEAD');
    });

    const divisionIds = Object.keys(rolesMap);

    // Find leave requests of users belonging to these divisions where approval is pending
    const leaves = await this.prisma.leaveRequest.findMany({
      where: {
        status: 'PENDING',
        user: {
          divisionId: { in: divisionIds },
        },
      },
      include: {
        user: { select: { id: true, fullName: true, email: true, divisionId: true } },
        approvals: true,
      },
    });

    // Filter down leaves to only ones that are currently waiting for *this specific level*
    return leaves.filter(leave => {
      const uDivId = leave.user.divisionId;
      if (!uDivId) return false;
      const myRolesForThisDiv = rolesMap[uDivId] || [];

      // Find the current pending step (lowest level that is still PENDING)
      const sortedApprovals = [...leave.approvals].sort((a, b) => a.level - b.level);
      const activeStep = sortedApprovals.find(a => a.status === 'PENDING');

      if (!activeStep) return false;
      return myRolesForThisDiv.includes(activeStep.roleName);
    });
  }

  async actionLeaveApproval(approverId: string, approvalId: string, action: 'APPROVED' | 'REJECTED', notes?: string) {
    this.logger.log(`Approver ${approverId} taking action (${action}) on approval step ${approvalId}`);
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const step = await tx.leaveApproval.findUnique({
          where: { id: approvalId },
          include: { leaveRequest: { include: { approvals: true } } },
        });

        if (!step) {
          throw new NotFoundException('Leave approval step not found.');
        }

        if (step.status !== 'PENDING') {
          throw new BadRequestException('This approval step has already been processed.');
        }

        // Check if previous levels are already approved (sequential routing)
        const priorSteps = step.leaveRequest.approvals.filter(a => a.level < step.level);
        const isPriorApproved = priorSteps.every(s => s.status === 'APPROVED');
        if (!isPriorApproved) {
          throw new BadRequestException('Prior levels of approval must be approved first.');
        }

        // 1. Update this specific approval step
        const updatedStep = await tx.leaveApproval.update({
          where: { id: approvalId },
          data: {
            status: action,
            approverId,
            notes,
            actionedAt: new Date(),
          },
        });

        const totalSteps = step.leaveRequest.approvals.length;
        const sortedSteps = [...step.leaveRequest.approvals].sort((a, b) => a.level - b.level);

        if (action === 'REJECTED') {
          // If rejected, entire request is rejected immediately
          this.logger.log(`Leave request ${step.leaveRequestId} was rejected at level ${step.level} by approver ${approverId}`);
          await tx.leaveRequest.update({
            where: { id: step.leaveRequestId },
            data: { status: 'REJECTED' },
          });
        } else if (action === 'APPROVED') {
          // Check if this was the final level
          const isFinalStep = step.level === Math.max(...sortedSteps.map(s => s.level));

          if (isFinalStep) {
            // If approved by final level, mark the whole request as APPROVED
            this.logger.log(`Leave request ${step.leaveRequestId} fully approved at final level ${step.level} by approver ${approverId}`);
            await tx.leaveRequest.update({
              where: { id: step.leaveRequestId },
              data: { status: 'APPROVED' },
            });

            // Auto-deduct Leave Balance if ANNUAL_LEAVE
            if (step.leaveRequest.type === 'ANNUAL_LEAVE') {
              const start = new Date(step.leaveRequest.startDate);
              const end = new Date(step.leaveRequest.endDate);
              const durationDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

              await tx.leaveBalance.update({
                where: { userId: step.leaveRequest.userId },
                data: {
                  used: { increment: durationDays },
                  remaining: { decrement: durationDays },
                },
              });
              this.logger.log(`Deducted ${durationDays} leave days from user ${step.leaveRequest.userId} balance.`);
            }
          } else {
            this.logger.log(`Leave request ${step.leaveRequestId} approved at intermediate level ${step.level} by approver ${approverId}`);
          }
        }

        return updatedStep;
      });

      await this.auditService.log(approverId, 'ACTION_LEAVE_APPROVAL', 'LeaveApproval', approvalId, { action, notes });
      return result;
    } catch (err) {
      this.logger.error(`Failed to action leave approval ${approvalId} by approver ${approverId}: ${err.message}`, err.stack);
      throw err;
    }
  }

  // =========================================================================
  // 6. SHIFT SWAP (Shift Trade / Tukar Shift)
  // =========================================================================

  async requestShiftSwap(requesterId: string, data: { targetUserId: string; requesterShiftId: string; targetShiftId: string }) {
    this.logger.log(`User ${requesterId} requesting shift swap. Target user: ${data.targetUserId}, Requester Shift: ${data.requesterShiftId}, Target Shift: ${data.targetShiftId}`);
    try {
      const swap = await this.prisma.shiftSwapRequest.create({
        data: {
          requesterId,
          targetUserId: data.targetUserId,
          requesterShiftId: data.requesterShiftId,
          targetShiftId: data.targetShiftId,
          status: 'PENDING',
        },
      });
      this.logger.log(`Successfully created shift swap request ${swap.id} for user ${requesterId}`);
      await this.auditService.log(requesterId, 'REQUEST_SHIFT_SWAP', 'ShiftSwapRequest', swap.id, { targetUserId: data.targetUserId, requesterShiftId: data.requesterShiftId, targetShiftId: data.targetShiftId });
      return swap;
    } catch (err) {
      this.logger.error(`Failed to request shift swap for user ${requesterId}: ${err.message}`, err.stack);
      throw err;
    }
  }

  async actionShiftSwap(userId: string, swapId: string, action: 'ACCEPT' | 'REJECT', notes?: string) {
    this.logger.log(`User ${userId} taking action (${action}) on shift swap request ${swapId}`);
    try {
      const swap = await this.prisma.shiftSwapRequest.findUnique({
        where: { id: swapId },
      });

      if (!swap) throw new NotFoundException('Shift swap request not found.');

      if (swap.targetUserId !== userId) {
        this.logger.warn(`User ${userId} unauthorized to action shift swap request ${swapId}`);
        throw new ForbiddenException('You are not authorized to action this swap request.');
      }

      if (action === 'REJECT') {
        const rejectedSwap = await this.prisma.shiftSwapRequest.update({
          where: { id: swapId },
          data: { status: 'REJECTED', rejectionNotes: notes },
        });
        this.logger.log(`Shift swap request ${swapId} rejected by target user ${userId}`);
        await this.auditService.log(userId, 'REJECT_SHIFT_SWAP', 'ShiftSwapRequest', swapId, { rejectionNotes: notes });
        return rejectedSwap;
      }

      // If accepted by target, set to TARGET_ACCEPTED (ready for Supervisor/Manager approval)
      // For extreme productivity, let's auto-process swap directly if configured, or wait for admin.
      // In this proposal, we auto-swap shifts directly on Target Acceptance to optimize speed!
      const result = await this.prisma.$transaction(async (tx) => {
        const updatedSwap = await tx.shiftSwapRequest.update({
          where: { id: swapId },
          data: { status: 'APPROVED' },
        });

        const rShift = await tx.workShift.findUnique({ where: { id: swap.requesterShiftId } });
        const tShift = await tx.workShift.findUnique({ where: { id: swap.targetShiftId } });

        // Swap shiftCategoryIds between requester and target
        await tx.workShift.update({
          where: { id: swap.requesterShiftId },
          data: { shiftCategoryId: tShift.shiftCategoryId },
        });

        await tx.workShift.update({
          where: { id: swap.targetShiftId },
          data: { shiftCategoryId: rShift.shiftCategoryId },
        });

        return updatedSwap;
      });

      this.logger.log(`Shift swap request ${swapId} approved and shifts swapped successfully`);
      await this.auditService.log(userId, 'ACCEPT_SHIFT_SWAP', 'ShiftSwapRequest', swapId, { action });
      return result;
    } catch (err) {
      this.logger.error(`Failed to action shift swap ${swapId} for user ${userId}: ${err.message}`, err.stack);
      throw err;
    }
  }

  // =========================================================================
  // ADMIN LEAVE MANAGEMENT
  // =========================================================================

  async adminGetLeaveBalances() {
    const users = await this.prisma.user.findMany({
      include: {
        leaveBalance: true,
        division: true,
      },
    });

    const currentYear = new Date().getFullYear();

    return Promise.all(
      users.map(async (u) => {
        let balance = u.leaveBalance;
        if (!balance) {
          balance = await this.prisma.leaveBalance.create({
            data: {
              userId: u.id,
              allocated: 12,
              used: 0,
              remaining: 12,
              year: currentYear,
            },
          });
        }
        return {
          userId: u.id,
          fullName: u.fullName,
          email: u.email,
          divisionName: u.division?.name || "Unassigned",
          allocated: balance.allocated,
          used: balance.used,
          remaining: balance.remaining,
        };
      })
    );
  }

  async adminUpdateLeaveBalance(adminId: string, userId: string, data: { allocated?: number; used?: number }) {
    this.logger.log(`Admin ${adminId} updating leave balance for user ${userId}. Data: ${JSON.stringify(data)}`);
    try {
      const balance = await this.prisma.leaveBalance.findUnique({
        where: { userId },
      });

      if (!balance) {
        throw new NotFoundException("Leave balance not found for this user");
      }

      const newAllocated = data.allocated !== undefined ? data.allocated : balance.allocated;
      const newUsed = data.used !== undefined ? data.used : balance.used;
      const newRemaining = newAllocated - newUsed;

      const updated = await this.prisma.leaveBalance.update({
        where: { userId },
        data: {
          allocated: newAllocated,
          used: newUsed,
          remaining: newRemaining,
        },
      });
      this.logger.log(`Successfully updated leave balance for user ${userId}. Allocated: ${newAllocated}, Used: ${newUsed}, Remaining: ${newRemaining}`);
      await this.auditService.log(adminId, 'UPDATE_LEAVE_BALANCE', 'LeaveBalance', userId, data);
      return updated;
    } catch (err) {
      this.logger.error(`Failed to update leave balance for user ${userId}: ${err.message}`, err.stack);
      throw err;
    }
  }

  async adminGetAllLeaveRequests() {
    return this.prisma.leaveRequest.findMany({
      include: {
        user: {
          include: {
            division: true,
          },
        },
        approvals: {
          include: {
            approver: {
              select: {
                fullName: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async adminOverrideLeaveRequest(adminId: string, requestId: string, data: { status: 'APPROVED' | 'REJECTED'; notes?: string }) {
    this.logger.log(`Admin ${adminId} overriding leave request ${requestId} to status ${data.status}`);
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const request = await tx.leaveRequest.findUnique({
          where: { id: requestId },
          include: { approvals: true },
        });

        if (!request) {
          throw new NotFoundException("Leave request not found");
        }

        if (request.status === data.status) {
          return request;
        }

        if (request.type === 'ANNUAL_LEAVE') {
          const start = new Date(request.startDate);
          const end = new Date(request.endDate);
          const durationDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

          const balance = await tx.leaveBalance.findUnique({
            where: { userId: request.userId },
          });

          if (balance) {
            let newUsed = balance.used;
            if (data.status === 'APPROVED' && request.status !== 'APPROVED') {
              newUsed += durationDays;
            } else if (data.status !== 'APPROVED' && request.status === 'APPROVED') {
              newUsed = Math.max(0, newUsed - durationDays);
            }
            const newRemaining = balance.allocated - newUsed;

            await tx.leaveBalance.update({
              where: { userId: request.userId },
              data: {
                used: newUsed,
                remaining: newRemaining,
              },
            });
            this.logger.log(`Leave request override: adjusted leave balance for user ${request.userId} to Used: ${newUsed}, Remaining: ${newRemaining}`);
          }
        }

        const updatedRequest = await tx.leaveRequest.update({
          where: { id: requestId },
          data: { status: data.status },
        });

        await tx.leaveApproval.updateMany({
          where: { leaveRequestId: requestId },
          data: {
            status: data.status,
            notes: data.notes || "Admin override",
            actionedAt: new Date(),
          },
        });

        return updatedRequest;
      });

      this.logger.log(`Successfully completed admin override of leave request ${requestId} to status ${data.status}`);
      await this.auditService.log(adminId, 'OVERRIDE_LEAVE_REQUEST', 'LeaveRequest', requestId, data);
      return result;
    } catch (err) {
      this.logger.error(`Failed to override leave request ${requestId}: ${err.message}`, err.stack);
      throw err;
    }
  }
}
