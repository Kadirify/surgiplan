# 3. Transactional outbox for e-mail

## Context

Scheduling a case notifies four or five people. If the SMTP call happens inside the request, a slow mail server slows down planning, and a failure leaves us choosing between rolling back a valid booking or silently losing the notification. Sending after commit has the opposite problem: the process can die between commit and send.

## Decision

E-mails are written to an `OutboxMessage` table in the same transaction as the business change. A worker (`OutboxWorker`) polls every 10 seconds, leases rows with a conditional update so two API instances never send the same message, and retries failures with exponential backoff up to six attempts.

In-app notifications are plain rows in the same transaction; Socket.IO only tells the browser to refetch.

## Consequences

- A booking and its notifications commit or roll back together.
- Delivery is at-least-once. A crash after the SMTP call but before marking the row as sent will resend that one message, which is acceptable for notifications.
- Mail delay is up to one polling interval. That is fine for this domain; nothing here needs sub-second e-mail.
