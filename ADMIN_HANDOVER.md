# Administrator handover — KG Stay Active

## Every shift
Open Command Centre and **Operations & handover**. Confirm the current release and system health, pending submissions, correction requests, duplicate reviews, and stale finalized weeks. Health is a scoped observation, not a guarantee.

## Ordinary activity reviews
Check the athlete, Singapore date, sport, distance/pace and proof. Owners and admins can view proof; other participants cannot. Pending/rejected points do not enter standings. A +3 friend bonus applies once per eligible sport per Singapore date, not per companion. Read the saved breakdown; do not manually add another bonus. A tiny qualifying workout can display base 0.00 but still have a positive half-point-rounded total.

## Corrections and results
Use correction requests for approved entries; document the reason and check duplicate warnings. Review the original and proposed values. Rebuild affected **completed** weeks after corrections; leave ongoing weeks unfinalized. A queue entry means saved results may be stale.

**Recalculate all scores is not routine maintenance.** Use it only for an approved historical correction with a verified pre-change backup and exact released code. A failed screen refresh or timeout does not prove the write failed: inspect the audit and database before retrying.

## Evidence and privacy
Use your own admin account. Do not share cookies, passwords, protected image references, exports, or participant data in public GitHub reports. Supabase proof storage must be private after the coordinated rollout. Do not re-publicize it to fix an image. Profile photos remain public by the present product choice. External Drive/Strava copies need the provider owner's separate permission review.

## Incident checklist
Record Singapore timestamp, release, route, redacted error and last known good operation. Stop repeated writes. Decide whether this is UI, data, availability or disclosure; escalate to the relevant owner. Keep the original backup and evidence. Production restore, bulk recalculation, database migration, bucket changes and billing actions require owner approval.

## Ownership handover (fill privately)
Record the primary and alternate app admin, GitHub/Vercel owner, Supabase owner, backup custodian, notification email/phone, escalation contact and approved credential-vault location. Do not record credentials in this repository. Agree recovery-time and acceptable-data-loss targets before an incident.

## Weekly
Review actual performance/error samples and finalized-result freshness, verify the latest private backup, confirm the separate image archive and off-site copy, and check billing alert delivery/configuration. Rehearse recovery against a new disposable environment, never over production. Follow RECOVERY_HARDENING.md; retain a dated pass/fail report without participant data.
