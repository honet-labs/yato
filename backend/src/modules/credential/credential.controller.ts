import { Controller, Get, Post, Put, Delete, Body, UseGuards, Request, Param } from '@nestjs/common';
import { CredentialService } from './credential.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateCredentialDto } from './dto/credential.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from '../auth/auth.service';

@ApiTags('credentials')
@ApiBearerAuth()
@Controller('credentials')
@UseGuards(JwtAuthGuard)
export class CredentialController {
  constructor(
    private credentialService: CredentialService,
    private authService: AuthService,
  ) {}

  @Post()
  async create(@Body() dto: CreateCredentialDto, @Request() req: any) {
    return this.credentialService.create(dto, req.user.id);
  }

  @Get()
  async findAll(@Request() req: any) {
    return this.credentialService.findAll(req.user.id, false);
  }

  @Get('tags')
  @ApiOperation({ summary: 'Get all unique tags from vault' })
  async getTags() {
    return this.credentialService.findAllTags();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get specific credential detail (password masked)' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.credentialService.findOne(id, req.user.id);
  }

  @Post(':id/reveal')
  @ApiOperation({ summary: 'Reveal credential secret after password re-authentication' })
  async revealSecret(
    @Param('id') id: string,
    @Body('password') password: string,
    @Request() req: any,
  ) {
    await this.authService.verifyPassword(req.user.id, password);
    return this.credentialService.revealSecret(id, req.user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update specific credential' })
  async update(@Param('id') id: string, @Body() dto: any, @Request() req: any) {
    return this.credentialService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete specific credential' })
  async delete(@Param('id') id: string, @Request() req: any) {
    return this.credentialService.delete(id, req.user.id);
  }
}
