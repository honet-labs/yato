import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { RoleModule } from './modules/role/role.module';
import { VmRequestModule } from './modules/vm-request/vm-request.module';
import { VmInventoryModule } from './modules/vm-inventory/vm-inventory.module';
import { CredentialModule } from './modules/credential/credential.module';
import { NotificationModule } from './modules/notification/notification.module';
import { AuditModule } from './modules/audit/audit.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { ServiceRequestModule } from './modules/service-request/service-request.module';
import { ServiceInventoryModule } from './modules/service-inventory/service-inventory.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { SystemConfigModule } from './modules/system-config/system-config.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { TicketCommentModule } from './modules/ticket-comment/ticket-comment.module';
import { SupportTicketModule } from './modules/support-ticket/support-ticket.module';
import { TerminalModule } from './modules/terminal/terminal.module';
import { AssetModule } from './modules/asset/asset.module';
import { TaskModule } from './modules/task/task.module';
import { StorageModule } from './modules/storage/storage.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { IntegrationModule } from './modules/integration/integration.module';
import { HrmModule } from './modules/hrm/hrm.module';
import { NoteModule } from './modules/note/note.module';
import { PmoModule } from './modules/pmo/pmo.module';
import { envValidationSchema } from './config/env.validation';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({ 
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: true, // Crash immediately if any env is missing/invalid
      },
    }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
      },
    }),
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 20,
      verboseMemoryLeak: true,
      ignoreErrors: false,
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => {
        const store = await redisStore({
          socket: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT) || 6379,
            keepAlive: true,
          },
          ttl: parseInt(process.env.CACHE_TTL_SECONDS || '600', 10),
        });

        // Listen to error events on the underlying Redis client to avoid crashing on socket drops
        const client = (store as any).client || ((store as any).getClient ? (store as any).getClient() : null);
        if (client) {
          client.on('error', (err: any) => {
            console.error('Redis Client Error:', err);
          });
        }

        return { store };
      },
    }),
    PrismaModule,
    AuthModule,
    UserModule,
    RoleModule,
    VmRequestModule,
    VmInventoryModule,
    CredentialModule,
    NotificationModule,
    AuditModule,
    ServiceRequestModule,
    ServiceInventoryModule,
    CatalogModule,
    SystemConfigModule,
    DashboardModule,
    TicketCommentModule,
    SupportTicketModule,
    TerminalModule,
    AssetModule,
    TaskModule,
    StorageModule,
    IntegrationModule,
    HrmModule,
    NoteModule,
    PmoModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
