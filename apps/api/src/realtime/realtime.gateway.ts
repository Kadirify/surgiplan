import { Inject, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Env, ENV } from '../config/env';

export interface SurgeryChangedEvent {
  surgeryId: string;
  roomId: string | null;
  status: string;
}

@WebSocketGateway({ path: '/api/socket.io', cors: { origin: true, credentials: true } })
export class RealtimeGateway implements OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(private readonly jwt: JwtService, @Inject(ENV) private readonly env: Env) {}

  async handleConnection(socket: Socket) {
    const token = socket.handshake.auth?.token as string | undefined;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token ?? '', { secret: this.env.JWT_ACCESS_SECRET });
      socket.join(`user:${payload.sub}`);
      socket.join('board');
    } catch {
      this.logger.debug(`Rejected socket ${socket.id}`);
      socket.disconnect(true);
    }
  }

  surgeryChanged(event: SurgeryChangedEvent) {
    this.server?.to('board').emit('surgery.changed', event);
  }

  notifyUsers(userIds: Iterable<string>) {
    for (const id of new Set(userIds)) {
      this.server?.to(`user:${id}`).emit('notification.created');
    }
  }
}
