import { Injectable } from '@nestjs/common';
import { PrismaService, Tx } from '../prisma/prisma.service';

export interface AuditEntry {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  changes?: unknown;
  ip?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  record(entry: AuditEntry, tx: Tx = this.prisma) {
    return tx.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        changes: entry.changes === undefined ? null : JSON.stringify(entry.changes),
        ip: entry.ip,
      },
    });
  }

  async list(params: { entity?: string; entityId?: string; actorId?: string; page: number; pageSize: number }) {
    const where = {
      entity: params.entity || undefined,
      entityId: params.entityId || undefined,
      actorId: params.actorId || undefined,
    };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        include: { actor: { select: { id: true, fullName: true, role: true } } },
      }),
    ]);
    return {
      total,
      items: items.map((i) => ({ ...i, changes: i.changes ? JSON.parse(i.changes) : null })),
    };
  }
}
