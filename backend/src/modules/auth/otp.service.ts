import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RequestOtpDto, VerifyOtpDto } from './dto/auth.dto';
import * as crypto from 'crypto';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  async generateOtp(dto: RequestOtpDto) {
    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await this.prisma.otp.create({
      data: {
        email: dto.email,
        phone: dto.phone,
        telegram: dto.telegram,
        code,
        type: dto.type,
        expiresAt,
      },
    });

    const message = `Your YATO verification code is: *${code}*.\n\nExpires in 5 minutes.`;
    
    this.logger.log(`OTP generated for ${dto.channel} (${dto.email || dto.phone || dto.telegram})`);
    
    try {
      if (dto.channel === 'WHATSAPP' && dto.phone) {
        let cleanPhone = dto.phone.replace(/[^0-9]/g, '');
        if (cleanPhone.startsWith('0')) {
          cleanPhone = '62' + cleanPhone.substring(1);
        }
        const res = await this.notificationService.sendWhatsApp(cleanPhone, message);
        if (!res.success) throw new Error(res.message);
      } else if (dto.channel === 'EMAIL' && dto.email) {
        const res = await this.notificationService.sendEmail(dto.email, 'YATO Verification Code', message);
        if (!res.success) throw new Error(res.message);
      } else if (dto.channel === 'TELEGRAM' && dto.telegram) {
        const res = await this.notificationService.sendTelegram(dto.telegram, message);
        if (!res.success) throw new Error(res.message);
      }
      
      this.logger.log(`OTP sent via ${dto.channel} to ${dto.email || dto.phone || dto.telegram}`);
      return { success: true, message: `OTP sent via ${dto.channel}` };
    } catch (error) {
      this.logger.error(`Failed to send OTP via ${dto.channel}: ${error.message}`);
      return { success: false, message: `Failed to deliver OTP: ${error.message}` };
    }
  }

  async verifyOtp(dto: VerifyOtpDto, deleteAfter: boolean = true) {
    const otp = await this.prisma.otp.findFirst({
      where: {
        OR: [
          { email: dto.email },
          { phone: dto.phone },
          { telegram: dto.telegram },
        ],
        code: dto.code,
        type: dto.type,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    if (deleteAfter) {
      await this.prisma.otp.delete({ where: { id: otp.id } });
    }
    
    return true;
  }
}
