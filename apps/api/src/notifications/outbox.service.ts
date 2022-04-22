import { Injectable } from '@nestjs/common';
import { Tx } from '../prisma/prisma.service';

export type MailTemplate =
  | 'invite'
  | 'reset-password'
  | 'surgery-assigned'
  | 'surgery-updated'
  | 'surgery-cancelled'
  | 'daily-list';

export interface EmailPayload {
  to: string;
  subject: string;
  template: MailTemplate;
  data: Record<string, unknown>;
}

@Injectable()
export class OutboxService {
  enqueueEmail(tx: Tx, payload: EmailPayload) {
    return tx.outboxMessage.create({
      data: { kind: 'email', payload: JSON.stringify(payload) },
    });
  }
}
