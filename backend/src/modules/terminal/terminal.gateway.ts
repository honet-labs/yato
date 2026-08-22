import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Client } from 'ssh2';
import { PrismaService } from '../prisma/prisma.service';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from '../../common/utils/encryption.service';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:3000'],
    credentials: true,
  },
  namespace: 'terminal',
})
@Injectable()
export class TerminalGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private logger = new Logger('TerminalGateway');
  private sshClients = new Map<string, Client>();

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private encryptionService: EncryptionService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) {
        this.logger.warn(`Client ${client.id} rejected: No token provided`);
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get('JWT_SECRET'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true },
      });

      if (!user) {
        this.logger.warn(`Client ${client.id} rejected: User not found`);
        client.disconnect();
        return;
      }

      (client as any).userId = user.id;
      (client as any).userEmail = user.email;
      this.logger.log(`Client connected: ${client.id} (user: ${user.email})`);
    } catch (err) {
      this.logger.warn(`Client ${client.id} rejected: ${err.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    const sshClient = this.sshClients.get(client.id);
    if (sshClient) {
      sshClient.end();
      this.sshClients.delete(client.id);
    }
  }

  @SubscribeMessage('startTerminal')
  async handleStartTerminal(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { vmId: string },
  ) {
    const userId = (client as any).userId;
    if (!userId) {
      client.emit('terminalError', 'Unauthorized');
      return;
    }

    const { vmId } = data;
    const vm = await this.prisma.vMInventory.findUnique({
      where: { requestId: vmId },
    });

    if (!vm) {
      client.emit('terminalError', 'VM not found in inventory');
      return;
    }

    const existingClient = this.sshClients.get(client.id);
    if (existingClient) {
      existingClient.end();
      this.sshClients.delete(client.id);
    }

    const ssh = new Client();
    this.sshClients.set(client.id, ssh);

    let sshPassword = vm.sshPassword || '';
    if (sshPassword && !sshPassword.startsWith('yv1:') && !sshPassword.includes(':')) {
      // Legacy unencrypted password - use as-is for backward compatibility
    } else if (sshPassword) {
      try {
        sshPassword = this.encryptionService.decrypt(sshPassword);
      } catch {
        // Use as-is if decryption fails (legacy format)
      }
    }

    ssh
      .on('ready', () => {
        ssh.shell((err, stream) => {
          if (err) {
            client.emit('terminalError', 'SSH Shell error: ' + err.message);
            return;
          }

          client.emit('terminalReady');

          stream.on('data', (data: Buffer) => {
            client.emit('terminalOutput', data.toString());
          });

          stream.on('close', () => {
            client.disconnect();
          });

          client.removeAllListeners('terminalInput');
          client.removeAllListeners('terminalResize');

          client.on('terminalInput', (input: string) => {
            stream.write(input);
          });

          client.on('terminalResize', (size: { cols: number; rows: number }) => {
            stream.setWindow(size.rows, size.cols, 0, 0);
          });
        });
      })
      .on('error', (err) => {
        this.logger.error(`SSH Error for ${vm.ipAddress}: ${err.message}`);
        client.emit('terminalError', 'SSH Connection failed: ' + err.message);
      })
      .connect({
        host: vm.ipAddress || '',
        port: vm.sshPort || 22,
        username: vm.sshUser || 'root',
        password: sshPassword,
        readyTimeout: 10000,
      });
  }
}
