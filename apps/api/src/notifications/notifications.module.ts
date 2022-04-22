import { Global, Module } from '@nestjs/common';
import { DailyListJob } from './daily-list.job';
import { MailerService } from './mailer.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { OutboxService } from './outbox.service';
import { OutboxWorker } from './outbox.worker';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [OutboxService, MailerService, OutboxWorker, NotificationsService, DailyListJob],
  exports: [OutboxService, NotificationsService, DailyListJob],
})
export class NotificationsModule {}
