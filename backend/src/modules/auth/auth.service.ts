import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import * as qrcode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto, RequestOtpDto, VerifyOtpDto, ResetPasswordDto } from './dto/auth.dto';
import { AuditService } from '../audit/audit.service';
import { OtpService } from './otp.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly BCRYPT_ROUNDS = 12;
  private readonly PASSWORD_HISTORY_COUNT = 5;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private auditService: AuditService,
    private otpService: OtpService,
  ) {}

  async checkEmail(email: string) {
    return { success: true, message: 'If this email is registered, you will receive an OTP.' };
  }

  async requestOtp(dto: RequestOtpDto) {
    if (dto.type === 'FORGOT_PASSWORD' && dto.email) {
      const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (!user) throw new BadRequestException('User not found');
      
      if (!dto.phone && user.phoneNumber) {
        dto.phone = user.phoneNumber;
      }
      if (!dto.telegram && user.telegramId) {
        dto.telegram = user.telegramId;
      }
    }

    if (dto.type === 'REGISTER') {
      const orConditions: any[] = [];
      if (dto.email) orConditions.push({ email: dto.email });
      if (dto.username) orConditions.push({ username: dto.username });

      if (orConditions.length > 0) {
        const existingUser = await this.prisma.user.findFirst({
          where: { OR: orConditions }
        });
        if (existingUser) {
          if (dto.email && existingUser.email === dto.email) throw new BadRequestException('Email already registered');
          if (dto.username && existingUser.username === dto.username) throw new BadRequestException('Username already taken');
        }
      }
    }
    return this.otpService.generateOtp(dto);
  }

  async verifyOtp(dto: VerifyOtpDto) {
    return this.otpService.verifyOtp(dto, true);
  }

  async checkOtp(dto: VerifyOtpDto) {
    return this.otpService.verifyOtp(dto, false);
  }

  async resetPassword(dto: ResetPasswordDto) {
    await this.otpService.verifyOtp({
      email: dto.email,
      code: dto.code,
      type: 'FORGOT_PASSWORD'
    });

    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new BadRequestException('User not found');

    // Check password history
    await this.checkPasswordHistory(user.id, dto.newPassword, user.previousPasswords);

    const hashedPassword = await bcrypt.hash(dto.newPassword, this.BCRYPT_ROUNDS);
    
    // Update password history
    const history = this.getPasswordHistoryArray(user.previousPasswords);
    history.push(user.password);
    if (history.length > this.PASSWORD_HISTORY_COUNT) {
      history.splice(0, history.length - this.PASSWORD_HISTORY_COUNT);
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { 
        password: hashedPassword, 
        previousPasswords: JSON.stringify(history),
        failedLoginAttempts: 0, 
        lockoutUntil: null 
      }
    });

    await this.auditService.log(user.id, 'PASSWORD_RESET', 'User', user.id);
    return { success: true, message: 'Password reset successful' };
  }

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: dto.email },
          { username: dto.username }
        ]
      },
    });
    if (existingUser) {
      if (existingUser.email === dto.email) throw new BadRequestException('Email already registered');
      throw new BadRequestException('Username already taken');
    }

    const hashedPassword = await bcrypt.hash(dto.password, this.BCRYPT_ROUNDS);
    const createData: any = {
      email: dto.email,
      username: dto.username || dto.email.split('@')[0],
      password: hashedPassword,
      previousPasswords: JSON.stringify([hashedPassword]),
      fullName: dto.fullName,
      phoneNumber: dto.phoneNumber,
      personalEmail: dto.personalEmail,
      telegramId: dto.telegramId,
    };

    let finalRoleIds = dto.roleIds || [];
    if (finalRoleIds.length === 0) {
      const userRole = await this.prisma.role.findUnique({
        where: { name: 'USER' }
      });
      if (userRole) {
        finalRoleIds = [userRole.id];
      }
    }

    if (finalRoleIds.length > 0) {
      createData.roles = {
        create: finalRoleIds.map((roleId: string) => ({
          roleId: roleId
        }))
      };
    }

    return this.prisma.user.create({
      data: createData,
      select: { id: true, email: true, fullName: true, phoneNumber: true, personalEmail: true, telegramId: true, roles: { include: { role: true } } },
    });
  }

  async login(dto: LoginDto, ipAddress: string, userAgent: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      await this.auditService.log(
        null,
        'FAILED_LOGIN_ATTEMPT',
        'User',
        null,
        { email: dto.email, message: 'User email not found', ipAddress, userAgent },
        ipAddress,
        userAgent
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      await this.auditService.log(
        user.id,
        'FAILED_LOGIN_LOCKED',
        'User',
        user.id,
        { email: dto.email, message: 'Account is locked', ipAddress, userAgent },
        ipAddress,
        userAgent
      );
      throw new UnauthorizedException('Account locked. Try again later.');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      await this.handleFailedLogin(user.id, user.failedLoginAttempts);
      await this.auditService.log(
        user.id,
        'FAILED_LOGIN_ATTEMPT',
        'User',
        user.id,
        { email: dto.email, message: 'Invalid password', ipAddress, userAgent },
        ipAddress,
        userAgent
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockoutUntil: null },
    });

    if (user.isMfaEnabled) {
      if (!dto.mfaToken) {
        return { mfaRequired: true, userId: user.id };
      }
      
      authenticator.options = { window: 1 };
      const cleanToken = dto.mfaToken.replace(/\s+/g, '').trim();

      let isMfaValid = false;

      if (cleanToken.startsWith('YATO-RC-') && user.mfaRecoveryCodes) {
        const storedHashedCodes = user.mfaRecoveryCodes.split(',');
        let matchingIndex = -1;

        for (let i = 0; i < storedHashedCodes.length; i++) {
          const match = await bcrypt.compare(cleanToken, storedHashedCodes[i]);
          if (match) {
            matchingIndex = i;
            break;
          }
        }

        if (matchingIndex !== -1) {
          isMfaValid = true;
          this.logger.warn(`User ${user.email} logged in using recovery code.`);

          storedHashedCodes.splice(matchingIndex, 1);
          await this.prisma.user.update({
            where: { id: user.id },
            data: { mfaRecoveryCodes: storedHashedCodes.join(',') }
          });
        }
      } else {
        isMfaValid = authenticator.check(cleanToken, user.mfaSecret);
      }

      if (!isMfaValid) {
        await this.auditService.log(
          user.id,
          'FAILED_LOGIN_MFA_FAILED',
          'User',
          user.id,
          { email: dto.email, message: 'Invalid MFA token', ipAddress, userAgent },
          ipAddress,
          userAgent
        );
        throw new UnauthorizedException('Invalid MFA token. Please ensure your device time is synced.');
      }
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    await this.prisma.loginHistory.create({
      data: {
        userId: user.id,
        ipAddress,
        userAgent,
      },
    });
    
    await this.auditService.log(user.id, 'LOGIN', 'User', user.id, { ipAddress, userAgent }, ipAddress, userAgent);

    const tokens = await this.generateTokens(user.id, user.email);
    return {
      ...tokens,
      forcePasswordChange: user.forcePasswordChange,
    };
  }

  private async handleFailedLogin(userId: string, currentAttempts: number) {
    const attempts = currentAttempts + 1;
    let lockoutUntil = null;

    if (attempts >= 5) {
      lockoutUntil = new Date(Date.now() + 15 * 60 * 1000);
      this.logger.warn(`Account locked for user ${userId} after 5 failed attempts`);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: attempts, lockoutUntil },
    });
  }

  async generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };
    
    let sessionTimeout = '15m';
    try {
      const setting = await this.prisma.systemSetting.findUnique({
        where: { key: 'SESSION_TIMEOUT' }
      });
      if (setting && setting.value) {
        const val = typeof setting.value === 'string' ? setting.value : String(setting.value);
        if (/^\d+$/.test(val)) {
          sessionTimeout = `${val}m`;
        } else {
          sessionTimeout = val;
        }
      }
    } catch (e) {
      // Fallback to 15m
    }

    return {
      access_token: this.jwtService.sign(payload, {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: sessionTimeout,
      }),
      refresh_token: this.jwtService.sign(payload, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      }),
    };
  }

  async generatePersonalAccessToken(userId: string, durationInDays: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');
    
    const payload = { sub: userId, email: user.email, isPat: true };
    const maxDays = 365;
    const effectiveDays = durationInDays === 0 ? maxDays : Math.min(durationInDays, maxDays);
    const expiresIn = `${effectiveDays}d`;
    
    const token = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_SECRET'),
      expiresIn: expiresIn,
    });
    
    const expiresAt = new Date(Date.now() + effectiveDays * 24 * 60 * 60 * 1000).toISOString();
    return { token, expiresAt };
  }

  async setupMfa(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(
      user.email,
      'YATO',
      secret,
    );
    const qrCode = await qrcode.toDataURL(otpauthUrl);

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: secret },
    });

    this.logger.log(`Setting up MFA for user ${userId}`);
    return { secret, qrCode };
  }

  async verifyAndEnableMfa(userId: string, token: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    
    authenticator.options = { window: 1 };
    const cleanToken = token.replace(/\s+/g, '').trim();

    const isValid = authenticator.check(cleanToken, user.mfaSecret);

    if (!isValid) {
      throw new BadRequestException('Invalid MFA token. Please ensure your device time is synced.');
    }

    const recoveryCodes: string[] = [];
    for (let i = 0; i < 5; i++) {
      const part1 = Math.random().toString(36).substring(2, 6).toUpperCase();
      const part2 = Math.random().toString(36).substring(2, 6).toUpperCase();
      recoveryCodes.push(`YATO-RC-${part1}-${part2}`);
    }

    const hashedCodes = await Promise.all(
      recoveryCodes.map((code) => bcrypt.hash(code, this.BCRYPT_ROUNDS))
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: { 
        isMfaEnabled: true,
        mfaRecoveryCodes: hashedCodes.join(','),
      },
    });

    this.logger.log(`MFA enabled for user ${userId}. Generated 5 recovery codes.`);
    return { success: true, recoveryCodes };
  }

  async disableMfa(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isMfaEnabled: false, mfaSecret: null },
    });
    return { success: true };
  }

  async verifyPassword(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      await this.auditService.log(
        userId,
        'FAILED_IDENTITY_VERIFICATION',
        'User',
        userId,
        { message: 'Invalid verification password' }
      );
      throw new UnauthorizedException('Invalid password');
    }

    await this.auditService.log(
      userId,
      'SUCCESS_IDENTITY_VERIFICATION',
      'User',
      userId,
      { message: 'Identity verified successfully' }
    );

    return { verified: true };
  }

  async logout(userId: string) {
    await this.auditService.log(userId, 'LOGOUT', 'User', userId);
    return { success: true };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const isCurrentValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentValid) throw new BadRequestException('Current password is incorrect');

    // Validate password complexity
    if (newPassword.length < 12) {
      throw new BadRequestException('Password must be at least 12 characters');
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) {
      throw new BadRequestException('Password must include uppercase, lowercase, number, and special character');
    }

    // Check password history
    await this.checkPasswordHistory(userId, newPassword, user.previousPasswords);

    const newHash = await bcrypt.hash(newPassword, 12);
    const history = this.getPasswordHistoryArray(user.previousPasswords);
    history.unshift(user.password);
    if (history.length > this.PASSWORD_HISTORY_COUNT) history.length = this.PASSWORD_HISTORY_COUNT;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: newHash,
        previousPasswords: JSON.stringify(history),
        forcePasswordChange: false,
      },
    });

    await this.auditService.log(userId, 'CHANGE_PASSWORD', 'User', userId);
    return { success: true, message: 'Password changed successfully' };
  }

  async updateProfile(userId: string, dto: any) {
    const updateData: any = {};
    
    if (dto.fullName !== undefined) updateData.fullName = dto.fullName;
    if (dto.phoneNumber !== undefined) updateData.phoneNumber = dto.phoneNumber;
    if (dto.telegramId !== undefined) updateData.telegramId = dto.telegramId;
    
    if (dto.username !== undefined && dto.username !== null && dto.username.trim() !== '') {
      const cleanUsername = dto.username.toLowerCase().replace(/[^a-z0-9_]/g, '');
      
      const existingUser = await this.prisma.user.findFirst({
        where: {
          username: cleanUsername,
          NOT: { id: userId }
        }
      });
      if (existingUser) {
        throw new BadRequestException('Username is already taken');
      }
      updateData.username = cleanUsername;
    }
    
    if (dto.emailNotificationEnabled !== undefined) updateData.emailNotificationEnabled = dto.emailNotificationEnabled;
    if (dto.whatsappNotificationEnabled !== undefined) updateData.whatsappNotificationEnabled = dto.whatsappNotificationEnabled;
    if (dto.telegramNotificationEnabled !== undefined) updateData.telegramNotificationEnabled = dto.telegramNotificationEnabled;

    return this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { 
        id: true, 
        email: true, 
        username: true, 
        fullName: true, 
        phoneNumber: true, 
        telegramId: true,
        emailNotificationEnabled: true,
        whatsappNotificationEnabled: true,
        telegramNotificationEnabled: true
      }
    });
  }

  private getPasswordHistoryArray(previousPasswords?: string | null): string[] {
    if (!previousPasswords) return [];
    try {
      const parsed = JSON.parse(previousPasswords);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private async checkPasswordHistory(userId: string, newPassword: string, previousPasswords?: string | null): Promise<void> {
    const history = this.getPasswordHistoryArray(previousPasswords);
    for (const oldHash of history) {
      const isReused = await bcrypt.compare(newPassword, oldHash);
      if (isReused) {
        throw new BadRequestException(`Password cannot be one of your last ${this.PASSWORD_HISTORY_COUNT} passwords`);
      }
    }
  }
}
