import { Module } from '@nestjs/common';
import { VmInventoryService } from './vm-inventory.service';
import { VmInventoryController } from './vm-inventory.controller';
import { AuthModule } from '../auth/auth.module';
import { EncryptionService } from '../../common/utils/encryption.service';

@Module({
  imports: [AuthModule],
  controllers: [VmInventoryController],
  providers: [VmInventoryService, EncryptionService],
  exports: [VmInventoryService],
})
export class VmInventoryModule {}
