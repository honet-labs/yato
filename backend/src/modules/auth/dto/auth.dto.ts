import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, MinLength, IsString, IsOptional, Matches } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@yato.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Password123!' })
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @ApiProperty({ required: false, example: '123456' })
  @IsOptional()
  @IsString()
  mfaToken?: string;
}

export class RegisterDto {
  @ApiProperty({ example: 'John Doe' })
  @IsNotEmpty()
  @IsString()
  fullName: string;

  @ApiProperty({ example: 'johndoe' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Password123!' })
  @IsNotEmpty()
  @MinLength(12)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{12,}$/, {
    message: 'Password must be at least 12 characters and contain uppercase, lowercase, number, and special character',
  })
  password: string;

  @ApiProperty({ example: '+628123456789' })
  @IsNotEmpty()
  @IsString()
  phoneNumber: string;

  @ApiProperty({ required: false, example: 'personal@example.com' })
  @IsOptional()
  @IsEmail()
  personalEmail?: string;

  @ApiProperty({ example: '@username' })
  @IsNotEmpty()
  @IsString()
  telegramId: string;

  @ApiProperty({ required: false, type: [String], example: ['role-id'] })
  @IsOptional()
  roleIds?: string[];
}

export class RequestOtpDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: '+628123456789' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: '@username' })
  @IsOptional()
  @IsString()
  telegram?: string;

  @ApiProperty({ example: 'johndoe' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiProperty({ example: 'EMAIL', enum: ['EMAIL', 'WHATSAPP', 'TELEGRAM'] })
  @IsNotEmpty()
  @IsString()
  channel: 'EMAIL' | 'WHATSAPP' | 'TELEGRAM';

  @ApiProperty({ example: 'REGISTER', enum: ['REGISTER', 'FORGOT_PASSWORD'] })
  @IsNotEmpty()
  @IsString()
  type: 'REGISTER' | 'FORGOT_PASSWORD';
}

export class VerifyOtpDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: '+628123456789' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: '@username' })
  @IsOptional()
  @IsString()
  telegram?: string;

  @ApiProperty({ example: '123456' })
  @IsNotEmpty()
  @IsString()
  code: string;

  @ApiProperty({ example: 'REGISTER' })
  @IsNotEmpty()
  @IsString()
  type: 'REGISTER' | 'FORGOT_PASSWORD';
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '123456' })
  @IsNotEmpty()
  @IsString()
  code: string;

  @ApiProperty({ example: 'NewPassword123!' })
  @IsNotEmpty()
  @MinLength(12)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{12,}$/, {
    message: 'Password must be at least 12 characters and contain uppercase, lowercase, number, and special character',
  })
  newPassword: string;
}

export class UpdateProfileDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  telegramId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  emailNotificationEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  whatsappNotificationEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  telegramNotificationEnabled?: boolean;
}

export class MfaSetupResponseDto {
  @ApiProperty()
  secret: string;

  @ApiProperty()
  qrCode: string;
}

export class VerifyMfaDto {
  @ApiProperty({ example: '123456' })
  @IsNotEmpty()
  @IsString()
  token: string;
}
