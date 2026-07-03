import { Module } from '@nestjs/common';
import { ServiceInventoryController } from './service-inventory.controller';
import { ServiceInventoryService } from './service-inventory.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ServiceInventoryController],
  providers: [ServiceInventoryService],
  exports: [ServiceInventoryService],
})
export class ServiceInventoryModule {}
