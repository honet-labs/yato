import { Module } from '@nestjs/common';
import { PmoService } from './pmo.service';
import { PmoController } from './pmo.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PmoController],
  providers: [PmoService],
  exports: [PmoService],
})
export class PmoModule {}
