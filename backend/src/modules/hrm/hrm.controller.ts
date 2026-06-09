import { Controller, Get, Post, Put, Patch, Delete, Body, UseGuards, Request, Param, Query, Ip, Headers } from '@nestjs/common';
import { HrmService } from './hrm.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('hrm')
@ApiBearerAuth()
@Controller('hrm')
@UseGuards(JwtAuthGuard)
export class HrmController {
  constructor(private readonly hrmService: HrmService) {}

  // =========================================================================
  // DIVISIONS
  // =========================================================================
  @Get('divisions')
  @ApiOperation({ summary: 'List all divisions' })
  async listDivisions() {
    return this.hrmService.listDivisions();
  }

  @Post('divisions')
  @ApiOperation({ summary: 'Create a new division' })
  async createDivision(@Request() req: any, @Body() dto: { name: string; description?: string; supervisorId?: string; managerId?: string; headId?: string }) {
    return this.hrmService.createDivision(req.user.id, dto);
  }

  @Put('divisions/:id')
  @ApiOperation({ summary: 'Update a division' })
  async updateDivision(@Request() req: any, @Param('id') id: string, @Body() dto: { name?: string; description?: string; supervisorId?: string; managerId?: string; headId?: string }) {
    return this.hrmService.updateDivision(req.user.id, id, dto);
  }

  // =========================================================================
  // SHIFTS
  // =========================================================================
  @Get('shifts/categories')
  @ApiOperation({ summary: 'List all shift categories' })
  async listShiftCategories() {
    return this.hrmService.listShiftCategories();
  }

  @Post('shifts/categories')
  @ApiOperation({ summary: 'Create shift category' })
  async createShiftCategory(@Request() req: any, @Body() dto: {
    name: string;
    startTime: string;
    endTime: string;
    breakStart: string;
    breakEnd: string;
    colorCode?: string;
    description?: string;
  }) {
    return this.hrmService.createShiftCategory(req.user.id, dto);
  }

  @Patch('shifts/categories/:id')
  @ApiOperation({ summary: 'Update shift category' })
  async updateShiftCategory(@Request() req: any, @Param('id') id: string, @Body() dto: {
    name?: string;
    startTime?: string;
    endTime?: string;
    breakStart?: string;
    breakEnd?: string;
    colorCode?: string;
    description?: string;
  }) {
    return this.hrmService.updateShiftCategory(req.user.id, id, dto);
  }

  @Delete('shifts/categories/:id')
  @ApiOperation({ summary: 'Delete shift category' })
  async deleteShiftCategory(@Request() req: any, @Param('id') id: string) {
    return this.hrmService.deleteShiftCategory(req.user.id, id);
  }

  @Post('shifts/assign')
  @ApiOperation({ summary: 'Assign a shift to a user' })
  async assignShift(@Request() req: any, @Body() dto: { userId: string; shiftCategoryId: string; date: string; notes?: string }) {
    return this.hrmService.assignShift(req.user.id, dto);
  }

  @Get('shifts/my-roster')
  @ApiOperation({ summary: 'Get current user shift roster' })
  async getMyRoster(@Request() req: any, @Query('start') start: string, @Query('end') end: string) {
    return this.hrmService.getRoster(req.user.id, start, end);
  }

  // =========================================================================
  // CLOCK-IN / OUT & TIMESHEET
  // =========================================================================
  @Post('timesheets/clock-in')
  @ApiOperation({ summary: 'Clock in' })
  async clockIn(
    @Request() req: any,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
    @Body() dto: { latenessReason?: string; customTime?: string; selfie?: string }
  ) {
    const time = dto.customTime ? new Date(dto.customTime) : undefined;
    return this.hrmService.clockIn(req.user.id, ipAddress, userAgent, dto.latenessReason, time, dto.selfie);
  }

  @Post('timesheets/clock-out')
  @ApiOperation({ summary: 'Clock out' })
  async clockOut(
    @Request() req: any,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
    @Body() dto: { notes?: string; customTime?: string; selfie?: string }
  ) {
    const time = dto.customTime ? new Date(dto.customTime) : undefined;
    return this.hrmService.clockOut(req.user.id, ipAddress, userAgent, dto.notes, time, dto.selfie);
  }

  @Get('timesheets/my')
  @ApiOperation({ summary: 'Get current user timesheets' })
  async getMyTimesheets(@Request() req: any, @Query('year') year: string, @Query('month') month: string) {
    return this.hrmService.getMyTimesheets(req.user.id, parseInt(year, 10), parseInt(month, 10));
  }

  @Get('timesheets/all')
  @ApiOperation({ summary: 'Get timesheets for all users on a specific date (Admin/HR only)' })
  async getAllTimesheets(@Query('date') date: string) {
    return this.hrmService.getAllTimesheets(date);
  }

  @Get('timesheets/division/:divisionId')
  @ApiOperation({ summary: 'Get timesheets for all users in a division on a specific date' })
  async getDivisionTimesheets(@Param('divisionId') divisionId: string, @Query('date') date: string) {
    return this.hrmService.getDivisionTimesheets(divisionId, date);
  }

  @Post('timesheets/adjust')
  @ApiOperation({ summary: 'Adjust timesheet manually (Admin only)' })
  async adjustAttendance(@Request() req: any, @Body() dto: {
    timesheetId: string;
    changedFrom: string;
    changedTo: string;
    reason: string;
    newTotalHours: number;
    newStatus?: string;
  }) {
    // Audit admin role or keep logging secure
    return this.hrmService.adjustAttendance({
      ...dto,
      adminId: req.user.id,
    });
  }

  // =========================================================================
  // LEAVE MANAGEMENT
  // =========================================================================
  @Get('leaves/balance')
  @ApiOperation({ summary: 'Get leave balance' })
  async getLeaveBalance(@Request() req: any, @Query('year') year: string) {
    const leaveYear = year ? parseInt(year, 10) : new Date().getFullYear();
    return this.hrmService.getLeaveBalance(req.user.id, leaveYear);
  }

  @Post('leaves')
  @ApiOperation({ summary: 'Request a new leave' })
  async requestLeave(@Request() req: any, @Body() dto: { type: string; startDate: string; endDate: string; reason: string; attachments?: string[] }) {
    return this.hrmService.requestLeave(req.user.id, dto);
  }

  @Get('leaves/my')
  @ApiOperation({ summary: 'Get user leaves list' })
  async getMyLeaves(@Request() req: any) {
    return this.hrmService.getMyLeaves(req.user.id);
  }

  @Get('leaves/pending')
  @ApiOperation({ summary: 'Get pending leave requests for approver' })
  async getPendingLeaves(@Request() req: any) {
    return this.hrmService.getPendingApprovals(req.user.id);
  }

  @Post('leaves/action/:id')
  @ApiOperation({ summary: 'Approve or Reject leave request' })
  async actionLeaveApproval(
    @Request() req: any,
    @Param('id') approvalId: string,
    @Body() dto: { action: 'APPROVED' | 'REJECTED'; notes?: string }
  ) {
    return this.hrmService.actionLeaveApproval(req.user.id, approvalId, dto.action, dto.notes);
  }

  // =========================================================================
  // SHIFT SWAPS
  // =========================================================================
  @Post('shifts/swap')
  @ApiOperation({ summary: 'Request shift swap' })
  async requestShiftSwap(@Request() req: any, @Body() dto: { targetUserId: string; requesterShiftId: string; targetShiftId: string }) {
    return this.hrmService.requestShiftSwap(req.user.id, dto);
  }

  @Post('shifts/swap/:id/action')
  @ApiOperation({ summary: 'Accept or reject shift swap' })
  async actionShiftSwap(@Request() req: any, @Param('id') swapId: string, @Body() dto: { action: 'ACCEPT' | 'REJECT'; notes?: string }) {
    return this.hrmService.actionShiftSwap(req.user.id, swapId, dto.action, dto.notes);
  }

  // =========================================================================
  // OVERTIME
  // =========================================================================
  @Post('overtimes')
  @ApiOperation({ summary: 'Request overtime claim' })
  async requestOvertime(@Request() req: any, @Body() dto: { timesheetId: string; hoursClaimed: number; reason: string }) {
    return this.hrmService.requestOvertime(req.user.id, dto);
  }

  @Post('overtimes/:id/action')
  @ApiOperation({ summary: 'Approve or reject overtime claim (Admin/SPV only)' })
  async actionOvertime(@Request() req: any, @Param('id') overtimeId: string, @Body() dto: { status: 'APPROVED' | 'REJECTED'; notes?: string }) {
    return this.hrmService.actionOvertime(req.user.id, overtimeId, dto.status, dto.notes);
  }

  // =========================================================================
  // ADMIN LEAVE MANAGEMENT ENDPOINTS
  // =========================================================================
  @Get('admin/leaves/balances')
  @ApiOperation({ summary: 'Get all user leave balances' })
  async adminGetLeaveBalances() {
    return this.hrmService.adminGetLeaveBalances();
  }

  @Patch('admin/leaves/balances/:userId')
  @ApiOperation({ summary: 'Customize a user leave balance' })
  async adminUpdateLeaveBalance(@Request() req: any, @Param('userId') userId: string, @Body() dto: { allocated?: number; used?: number }) {
    return this.hrmService.adminUpdateLeaveBalance(req.user.id, userId, dto);
  }

  @Get('admin/leaves/requests')
  @ApiOperation({ summary: 'Get all leave requests for admin oversight' })
  async adminGetAllLeaveRequests() {
    return this.hrmService.adminGetAllLeaveRequests();
  }

  @Patch('admin/leaves/requests/:requestId/status')
  @ApiOperation({ summary: 'Admin force override leave request status' })
  async adminOverrideLeaveRequest(@Request() req: any, @Param('requestId') requestId: string, @Body() dto: { status: 'APPROVED' | 'REJECTED'; notes?: string }) {
    return this.hrmService.adminOverrideLeaveRequest(req.user.id, requestId, dto);
  }
}
