-- EXECUTABLE REVIEW TEMPLATE ONLY. NEVER AUTO-APPLY. Does not activate billing or jobs.
-- Run with psql ONLY after separate approvals, with explicit parameters:
-- -v registration_reviewed=true -v endpoint_reviewed=true -v privilege_reviewed=true
-- -v billing_endpoint=https://<reviewed-project>.supabase.co/functions/v1/billing-orchestrator
-- -v scheduler_vault_name=<separately-approved-existing-Vault-name>
-- Requires existing pg_cron, pg_net and Vault; this template installs no extensions/secrets.
\if :{?registration_reviewed}
\else
\echo 'Registration approval parameter required'
\quit
\endif
\if :registration_reviewed
\else
\quit
\endif
\if :endpoint_reviewed
\else
\quit
\endif
\if :privilege_reviewed
\else
\quit
\endif
BEGIN;
SELECT set_config('billing.reviewed_endpoint', :'billing_endpoint', true);
SELECT set_config('billing.reviewed_secret_name', :'scheduler_vault_name', true);
DO $$ BEGIN
 IF current_setting('billing.reviewed_endpoint') !~ '^https://[a-z0-9]+\.supabase\.co/functions/v1/billing-orchestrator$' OR
 current_setting('billing.reviewed_secret_name') !~ '^[A-Za-z0-9_-]{1,80}$' THEN RAISE EXCEPTION 'reviewed_endpoint_and_secret_reference_required'; END IF;
 IF to_regnamespace('cron') IS NULL OR to_regnamespace('net') IS NULL OR to_regclass('vault.decrypted_secrets') IS NULL THEN RAISE EXCEPTION 'existing_scheduler_capability_required'; END IF;
END $$;
-- Freeze only reviewed references into job text; never interpolate or print a secret value.
SELECT cron.schedule('aqua-clear-billing-invoices','* * * * *',format(
 $job$SELECT net.http_post(url:=%L,headers:=jsonb_build_object('Content-Type','application/json','Authorization',
 (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name=%L)),body:='{"action":"schedule"}'::jsonb)
 WHERE (SELECT count(*) FROM vault.decrypted_secrets WHERE name=%L)=1;$job$,
 current_setting('billing.reviewed_endpoint'),current_setting('billing.reviewed_secret_name'),current_setting('billing.reviewed_secret_name')));
SELECT cron.alter_job(job_id:=jobid,active:=false) FROM cron.job WHERE jobname='aqua-clear-billing-invoices';
SELECT cron.schedule('aqua-clear-billing-announcements','* * * * *',format(
 $job$SELECT net.http_post(url:=%L,headers:=jsonb_build_object('Content-Type','application/json','Authorization',
 (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name=%L)),body:='{"action":"schedule_announcements"}'::jsonb)
 WHERE (SELECT count(*) FROM vault.decrypted_secrets WHERE name=%L)=1;$job$,
 current_setting('billing.reviewed_endpoint'),current_setting('billing.reviewed_secret_name'),current_setting('billing.reviewed_secret_name')));
SELECT cron.alter_job(job_id:=jobid,active:=false) FROM cron.job WHERE jobname='aqua-clear-billing-announcements';
-- Both registrations become visible only at commit, already inactive. No enabling here.
COMMIT;
