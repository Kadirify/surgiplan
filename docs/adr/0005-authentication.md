# 5. Short-lived access tokens, rotating refresh tokens

## Context

The app runs on shared workstations and tablets in the operating theatre. Sessions must survive a twelve-hour shift without constant logins, and a stolen token must not be useful for long.

## Decision

- **Access token:** JWT, 15 minutes, kept in memory only (never in `localStorage`).
- **Refresh token:** opaque random value in an `httpOnly`, `SameSite=Strict` cookie scoped to `/api/auth`. Only its SHA-256 hash is stored.
- Every refresh **rotates** the token. Tokens belong to a family; if an already-rotated token comes back, the whole family is revoked (reuse detection).
- Five failed logins lock the account for 15 minutes. Login, forgot-password and set-password are rate limited.
- New users get an invite link and set their own password. Admins never see or type user passwords.
- Changing a role, deactivating a user or resetting a password revokes that user's refresh tokens.

Authorisation is two layers: a role → permission map from the shared package checked by a global guard, and record-level checks in the services (surgeons and assistants only act on their own cases; assistants see their supervising surgeon's cases).

## Consequences

- XSS cannot read the refresh token; CSRF cannot use it outside the auth path.
- The SPA restores the session on load by calling `/auth/refresh`, which costs one request per page load.
- Multiple concurrent 401s are collapsed into a single refresh call on the client.
