import { Module } from '@nestjs/common';
import { ServiceInventoryController } from './service-inventory.controller';
import { ServiceInventoryService } from './service-inventory.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { EncryptionService } from '../../common/utils/encryption.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ServiceInventoryController],
  providers: [ServiceInventoryService, EncryptionService],
  exports: [ServiceInventoryService],
})
export class ServiceInventoryModule {}
