import { Module } from '@nestjs/common';
import { VmInventoryService } from './vm-inventory.service';
import { VmInventoryController } from './vm-inventory.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [VmInventoryController],
  providers: [VmInventoryService],
  exports: [VmInventoryService],
})
export class VmInventoryModule {}
