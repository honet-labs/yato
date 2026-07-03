import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TerminalGateway } from './terminal.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { CredentialModule } from '../credential/credential.module';

@Module({
  imports: [
    PrismaModule,
    CredentialModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [TerminalGateway],
})
export class TerminalModule {}
