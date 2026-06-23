import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { VmRequestService } from './vm-request.service';
import { CreateVmRequestDto, ApproveVmRequestDto } from './dto/vm-request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@ApiTags('vm-requests')
@Controller('vm/request')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@ApiBearerAuth()
export class VmRequestController {
  constructor(private readonly vmRequestService: VmRequestService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new VM request' })
  create(@Body() dto: CreateVmRequestDto, @Req() req: any) {
    return this.vmRequestService.create(dto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all VM requests (filtered by user access)' })
  async findAll(@Req() req) {
    return this.vmRequestService.findAll(req.user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get VM request detail' })
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.vmRequestService.findOne(id, req.user);
  }

  @Post(':id/followers')
  @ApiOperation({ summary: 'Add a follower to a VM request' })
  async addFollower(@Param('id') id: string, @Body('userId') userId: string) {
    return this.vmRequestService.addFollower(id, userId);
  }

  @Delete(':id/followers/:userId')
  @ApiOperation({ summary: 'Remove a follower from a VM request' })
  async removeFollower(@Param('id') id: string, @Param('userId') userId: string) {
    return this.vmRequestService.removeFollower(id, userId);
  }

  @Put(':id/approve')
  @Permissions('APPROVE_REQUESTS')
  @ApiOperation({ summary: 'Approve a VM request' })
  approve(@Param('id') id: string, @Req() req: any, @Body() dto: ApproveVmRequestDto) {
    return this.vmRequestService.approve(id, req.user.id, dto);
  }

  @Put(':id/reject')
  @Permissions('APPROVE_REQUESTS')
  @ApiOperation({ summary: 'Reject a VM request' })
  reject(@Param('id') id: string, @Req() req: any, @Body('reason') reason: string) {
    return this.vmRequestService.reject(id, req.user.id, reason);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a VM request' })
  update(@Param('id') id: string, @Body() dto: Partial<CreateVmRequestDto>, @Req() req: any) {
    return this.vmRequestService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete a VM request (Admin only)' })
  deleteRequest(@Param('id') id: string, @Req() req: any) {
    return this.vmRequestService.deleteRequest(id, req.user.id);
  }
}
