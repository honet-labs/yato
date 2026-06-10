import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCredentialDto {
  @ApiProperty({ example: 'Production AWS Key' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'SSH Key' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({ example: '192.168.1.100', required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ example: 'admin', required: false })
  @IsString()
  @IsOptional()
  username?: string;

  @ApiProperty({ example: 'secret-password', required: false })
  @IsString()
  @IsOptional()
  password?: string;

  @ApiProperty({ example: 'Access to prod server', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: ['production', 'aws'], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiProperty({ example: { port: 22, region: 'us-east-1' }, required: false })
  @IsOptional()
  metadata?: Record<string, any>;
}
