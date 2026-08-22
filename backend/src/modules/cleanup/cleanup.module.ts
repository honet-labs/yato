import { Module } from '@nestjs/common';
import { CleanupSchedulerService } from './cleanup-scheduler.service';

@Module({
  providers: [CleanupSchedulerService],
  exports: [CleanupSchedulerService],
})
export class CleanupModule {}
