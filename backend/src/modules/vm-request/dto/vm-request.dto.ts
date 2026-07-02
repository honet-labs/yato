import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, IsOptional, Min, Max, IsIP } from 'class-validator';

export class CreateVmRequestDto {
  @ApiProperty({ example: 4 })
  @IsInt()
  @Min(1)
  cpu: number;

  @ApiProperty({ example: 8 })
  @IsInt()
  @Min(1)
  ram: number;

  @ApiProperty({ example: 100 })
  @IsInt()
  @Min(1)
  disk: number;

  @ApiProperty({ example: 'web-server-01' })
  @IsString()
  @IsNotEmpty()
  hostname: string;

  @ApiProperty({ example: 'ubuntu-22.04' })
  @IsString()
  @IsNotEmpty()
  osTemplate: string;

  @ApiProperty({ example: 'VMware vCenter', required: false })
  @IsString()
  @IsOptional()
  hypervisor?: string;

  @ApiProperty({ example: 'production' })
  @IsString()
  @IsNotEmpty()
  environment: string;

  @ApiProperty({ example: 'Needed for new microservice deployment', required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ example: 'PENDING', required: false })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({ example: '192.168.1.50', required: false })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiProperty({ example: 'root', required: false })
  @IsOptional()
  @IsString()
  sshUser?: string;

  @ApiProperty({ example: 'password123', required: false })
  @IsOptional()
  @IsString()
  sshPassword?: string;

  @ApiProperty({ example: 22, required: false })
  @IsOptional()
  @IsInt()
  sshPort?: number;
}

export class ApproveVmRequestDto {
  @ApiProperty({ example: '10.0.0.1', required: false })
  @IsOptional()
  @IsIP(4, { message: 'IP Address harus berupa format IPv4 yang valid' })
  ipAddress?: string;

  @ApiProperty({ example: 'root', required: false })
  @IsOptional()
  @IsString()
  sshUser?: string;

  @ApiProperty({ example: 'password123', required: false })
  @IsOptional()
  @IsString()
  sshPassword?: string;

  @ApiProperty({ example: 22, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  sshPort?: number;
}
