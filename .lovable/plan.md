# Pre-publish go/no-go (read-only)

## Verdict: GO, with one condition
Publishing is reasonably safe. The new QuickBooks work only reads data, and only admins can see it. Condition: decide whether you want the live site to have the LIVE QuickBooks connection before you have checked invoice #350154860.

## Checked in this audit
- **Tests:** all 152 pass (12 groups). No build errors are logged.
- **Live site vs preview:** the live site (aquaclear-pools.lovable.app / getaquaclear.com) does not have the QuickBooks page yet. The preview does: the admin menu link, the dashboard tile, the Billing link, LIVE/SANDBOX labels and the key Yes/No check. Publishing brings all of these live.
- **QuickBooks connections:** there are now two, kept apart. One is Sandbox (company 9341458549860760) and one is Production (company 9341452568721903). Neither is flagged for reconnect. So a live sign-in worked after the three "invalid_client" failures at 12:49–12:51 UTC.
- **Production mode is on.** QuickBooks keys are shared between preview and live. So once you publish, the live QuickBooks page will also use the Production company.
- **Read-only:** checks in the code confirm QuickBooks requests are read-only (GET), every connection lookup matches the active environment, and keys stay on the server. The page only shows Yes/No for keys.
- **Karen Crago:** one invitation was created in the last 24 hours. Her record is still not linked to a login, so she has not finished signing up yet. Whether the email was delivered was not checked.

## Not verified
- Invoice #350154860 ($5, paid) has not been looked up on the Production connection yet. Nobody has run that check.
- I did not sign in as an admin, so I have not seen the QuickBooks page or menu myself.
- Edge function logs and email delivery logs were not checked in this audit.

## Safety of messages and billing
- Texts, broadcasts, invitations and Billing all need an admin to press a button. Billing is off by default and only exists in the preview. This audit found no automatic invoicing and no QuickBooks writes.
- Earlier work set it up so broadcasts send only from the server, after a confirmation step, and skip people who opted out.

## Recommended order
1. In the preview, open QuickBooks while signed in as admin. Confirm it says LIVE and Connected, then test invoice 350154860. Expect $5 and a $0 balance.
2. If that matches, publish: click Publish at the top right, then Update.
3. After publishing, open getaquaclear.com/admin/quickbooks and confirm the page loads.

There are no blockers in code. Approving this plan does not publish anything.
