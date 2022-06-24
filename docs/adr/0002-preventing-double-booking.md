# 2. Preventing double booking

## Context

Two coordinators can drag cases onto the board at the same moment. A check-then-insert in application code is not enough: both requests read "free", both write, and the room, the surgeon or the only operating microscope ends up in two places at once.

SQL Server has no exclusion constraints, and a booking touches several resources at once (room, surgeon, anesthetist, team members, equipment), so a single unique index cannot express the rule.

## Decision

Scheduling runs in one transaction that:

1. Takes an exclusive `sp_getapplock` for **every** resource the booking touches (`room:<id>`, `user:<id>`, `equipment:<id>`). Keys are sorted before locking so two transactions always acquire them in the same order and cannot deadlock.
2. Re-reads overlapping bookings and runs the conflict engine (`apps/api/src/surgeries/conflicts.ts`).
3. Writes with an optimistic version check (`WHERE id = ? AND version = ?`).

The locks are owned by the transaction and released on commit or rollback. Isolation level is READ COMMITTED; the application locks already serialise writers that share a resource, and SERIALIZABLE range locks would add deadlocks between unrelated rooms.

The conflict engine itself is a pure function with no I/O. It is unit tested for the edge cases that matter here: back-to-back cases, room turnover on either side, equipment with more than one unit, people listed in different roles in different cases, and leave periods.

## Consequences

- Correct under concurrency without relying on the UI.
- Writers for the same room or person queue for up to 5 seconds, then get a 409 asking them to retry.
- Every write path that can create occupancy must go through `schedule`. Status transitions only ever free resources, so they don't need the locks.
