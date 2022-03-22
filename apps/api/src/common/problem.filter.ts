import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

interface Problem {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance: string;
  requestId?: string;
  [extra: string]: unknown;
}

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request & { id?: string }>();
    const res = ctx.getResponse<Response>();

    const problem = this.toProblem(exception);
    problem.instance = req.originalUrl;
    problem.requestId = req.id;

    if (problem.status >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    res.status(problem.status).type('application/problem+json').json(problem);
  }

  private toProblem(exception: unknown): Problem {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const base: Problem = {
        type: 'about:blank',
        title: HttpStatus[status]?.replace(/_/g, ' ') ?? 'Error',
        status,
        instance: '',
      };
      if (typeof body === 'string') return { ...base, detail: body };

      const { message, error, statusCode, ...rest } = body as Record<string, unknown>;
      void error;
      void statusCode;
      if (Array.isArray(message)) {
        return { ...base, title: 'Validation failed', detail: 'Bazı alanlar geçersiz.', errors: message, ...rest };
      }
      return { ...base, detail: typeof message === 'string' ? message : undefined, ...rest };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return { type: 'about:blank', title: 'Conflict', status: 409, detail: 'Bu kayıt zaten mevcut.', instance: '' };
      }
      if (exception.code === 'P2025') {
        return { type: 'about:blank', title: 'Not Found', status: 404, detail: 'Kayıt bulunamadı.', instance: '' };
      }
    }

    return {
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
      detail: 'Beklenmeyen bir hata oluştu.',
      instance: '',
    };
  }
}
