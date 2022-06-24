# 4. Store UTC, think in hospital time

## Context

Users think in wall-clock time at the hospital ("AH-2 at 08:00 tomorrow"). Servers, containers and CI runners may run in UTC or anywhere else. Mixing the two produces bugs that only show up after midnight UTC, which in Istanbul is 03:00, right in the middle of a night shift.

## Decision

- Every timestamp is stored as UTC (`datetime2`), and containers run with `TZ=UTC`.
- "Which day" and "what time" are always computed in `Europe/Istanbul` (`HOSPITAL_TIME_ZONE` in the shared package) using `date-fns-tz`, never with the server's local time.
- Day boundaries for queries are built with `zonedTimeToUtc('YYYY-MM-DDT00:00', tz)`.
- Cron jobs pass `timeZone` explicitly (the daily list goes out at 17:00 hospital time).
- The UI formats every instant through `lib/format.ts`, so a coordinator travelling abroad still sees the hospital schedule.

## Consequences

- The time zone is a single constant; a hospital in another zone changes one line.
- Developers must not use `new Date().getHours()` for business logic. Code review should catch it.
