import { Module } from '@nestjs/common';
import { HrmController } from './hrm.controller';
import { HrmService } from './hrm.service';
import { HrmSchedulerService } from './hrm-scheduler.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { StorageModule } from '../storage/storage.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, NotificationModule, StorageModule, AuditModule],
  controllers: [HrmController],
  providers: [HrmService, HrmSchedulerService],
  exports: [HrmService],
})
export class HrmModule {}

