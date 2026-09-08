# Billing alert activation — owner action required

**Not enabled or inspected by this pull request.** No spending amount, webhook, phone number, payment setting or automatic pause is set by the app. The connected Vercel actions available during preparation do not expose billing configuration. Choose the amount and verify the saved provider settings before marking this complete.

1. In Vercel select **NitroCharge** and open **Settings → Billing → Spend Management** as an Owner/Billing user. Inspect current cycle spend before saving any threshold.
2. Choose the threshold in **USD per billing cycle**. It applies to the team's metered usage beyond included credits/allocations, not the entire invoice; seats, integrations and separate add-ons are outside that measure. This team may contain projects other than fitness-tracker.
3. For an alerts-only setup, explicitly verify **Pause production deployments is OFF** and no unwanted webhook action is selected. Do not rely on a default. Pausing affects all production projects on the team, and alerts alone do not cap charges.
4. In **My Notifications**, verify Spend Management web/email alerts at **50%, 75%, 100%**. SMS at 100% is optional and each owner configures their own recipient preferences. Never paste a verification code here.
5. Reopen the settings, record the amount, currency, billing-cycle date, recipients and pause setting privately. Verify receipt through the provider's supported test/activity mechanism when available. Do not manufacture spend to trigger an alert. Setting below already-accrued spend can trigger configured actions.

Track activation separately from deployment: owner __; threshold USD __; recipients confirmed __; pause reviewed __; provider activity/receipt evidence __; date __. An app deployment cannot verify or enable this checklist.

Primary references, reviewed 7 September 2026:
- https://vercel.com/docs/spend-management
- https://vercel.com/docs/notifications
