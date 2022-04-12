import { ConflictException } from '@nestjs/common';
import { Tx } from '../prisma/prisma.service';

// Keys are sorted so concurrent transactions lock in the same order and cannot deadlock.
export async function lockResources(tx: Tx, keys: Iterable<string>, timeoutMs = 5000) {
  for (const key of [...new Set(keys)].sort()) {
    const rows = await tx.$queryRaw<Array<{ result: number }>>`
      DECLARE @result int;
      EXEC @result = sp_getapplock @Resource = ${key}, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = ${timeoutMs};
      SELECT @result AS result;
    `;
    if (!rows.length || rows[0].result < 0) {
      throw new ConflictException('Bu kaynak şu anda başka bir kullanıcı tarafından planlanıyor. Lütfen tekrar deneyin.');
    }
  }
}
