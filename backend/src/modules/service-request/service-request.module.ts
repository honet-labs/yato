import { Module } from '@nestjs/common';
import { ServiceRequestController } from './service-request.controller';
import { ServiceRequestService } from './service-request.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { EncryptionService } from '../../common/utils/encryption.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [ServiceRequestController],
  providers: [ServiceRequestService, EncryptionService],
  exports: [ServiceRequestService],
})
export class ServiceRequestModule {}
