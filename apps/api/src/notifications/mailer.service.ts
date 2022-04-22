import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { readFileSync, readdirSync } from 'fs';
import Handlebars from 'handlebars';
import { createTransport, Transporter } from 'nodemailer';
import { join } from 'path';
import { Env, ENV } from '../config/env';
import { EmailPayload, MailTemplate } from './outbox.service';

@Injectable()
export class MailerService implements OnModuleInit {
  private transport: Transporter;
  private layout: Handlebars.TemplateDelegate;
  private templates = new Map<string, Handlebars.TemplateDelegate>();

  constructor(@Inject(ENV) private readonly env: Env) {}

  onModuleInit() {
    this.transport = createTransport({
      host: this.env.SMTP_HOST,
      port: this.env.SMTP_PORT,
      secure: this.env.SMTP_PORT === 465,
      auth: this.env.SMTP_USER ? { user: this.env.SMTP_USER, pass: this.env.SMTP_PASS } : undefined,
    });

    const dir = join(__dirname, 'templates');
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.hbs'))) {
      const compiled = Handlebars.compile(readFileSync(join(dir, file), 'utf8'));
      if (file === 'layout.hbs') this.layout = compiled;
      else this.templates.set(file.replace('.hbs', ''), compiled);
    }
  }

  render(template: MailTemplate, data: Record<string, unknown>, subject: string): string {
    const body = this.templates.get(template);
    if (!body) throw new Error(`Unknown mail template: ${template}`);
    return this.layout({ subject, webOrigin: this.env.WEB_ORIGIN, body: body({ ...data, webOrigin: this.env.WEB_ORIGIN }) });
  }

  async send(payload: EmailPayload) {
    await this.transport.sendMail({
      from: this.env.MAIL_FROM,
      to: payload.to,
      subject: payload.subject,
      html: this.render(payload.template, payload.data, payload.subject),
    });
  }
}
