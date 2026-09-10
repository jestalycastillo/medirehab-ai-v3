# Operations and Privacy

## Deployment

Apply database changes before starting the API:

```powershell
cd server
npx prisma migrate deploy
```

The repository's Docker Compose backend command already runs this step. The
live-chat branch adds migrations for chat, presence, care plans, help requests,
consent/audit records, and notification preferences.

## Data Boundaries

- Exercise recordings are streamed to the AI service for evaluation. The Node
  server does not write the uploaded video to disk or the database.
- Scores, session feedback, check-ins, care-plan data, chat messages, presence
  timestamps, consent timestamps, and audit events are persisted in PostgreSQL.
- Recording is blocked until the patient explicitly enables both privacy and
  camera consent. Revoking consent blocks future recordings.
- Chat supports text only. Attachments are intentionally excluded until file
  malware scanning, authorization, size limits, and retention are designed.

## Suggested Retention

- Keep care sessions and clinician notes according to the applicable clinical
  record policy for the deployment jurisdiction.
- Review chat-message retention with the same policy owner; do not assume chat
  is exempt from the clinical record.
- Keep audit events for at least the period required to investigate account and
  record changes.
- Presence timestamps are operational metadata and should use a shorter
  retention period where regulations permit.

## Backup and Restore

Create encrypted PostgreSQL backups on a schedule appropriate to the deployment
and store them outside the application host. Test restoration regularly in an
isolated environment. A backup is not verified until a restore has completed
and the Prisma migration status and representative records have been checked.

Minimum restore checks:

```powershell
cd server
npx prisma migrate status
npx prisma validate
npm run build
```

Never restore production health data into a developer environment without an
approved de-identification process.
