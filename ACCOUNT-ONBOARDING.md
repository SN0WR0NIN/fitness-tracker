# Participant account onboarding

Apply `prisma/account-onboarding.sql` to the existing database before deploying this code. It only adds fields and a username index. Generate the Prisma client during the build. Do not roll out the code first: authentication reads the new fields.

Admin → Users → Create logins / confirm emails:
- Select an unclaimed imported record to preserve its ID and activity history, or create a new member.
- Assign a unique username. A random temporary password is displayed once, expires in 72 hours, and is stored only as a bcrypt hash.
- Share the credentials privately. Reissuing before activation invalidates the old temporary password.
- The participant opens `/auth/setup`, supplies temporary credentials, chooses a new password and requests an email address. Temporary credentials never create a normal session.
- After setup, username login works immediately. Email login changes only after an admin confirms the requested address.
- Participants can change their password and request later email changes at `/account`, linked from the dashboard. Changing the password invalidates existing sessions.

Confirmation is a manual admin decision, not proof delivered by an email verification service. No email sending or automated password recovery is configured. Existing activated accounts cannot be reset through the provisioning form.

Login and setup share a database-backed limit of 10 attempts per account per 15-minute window. Existing email/password users keep working; their username can remain null.

Before rollout, validate against a staging database: provision, reject normal login with temporary credentials, finish setup, sign in with the username, confirm/reject email, change password and check old-session invalidation. Also check imported points are unchanged. No real participant credentials should be added to Git.
