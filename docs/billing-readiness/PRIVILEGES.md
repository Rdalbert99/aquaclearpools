# Unapplied final permission inventory

No live permissions changed. Final installation state after BOTH SQL files:
- PUBLIC, anon, authenticated, service_role: NO direct privileges on any new qbo_billing table.
- RLS enabled; no anon/authenticated policies. Migration-owner definer retains table ownership.
- PUBLIC/anon/authenticated: NO execution on any qbo_billing function.
- service_role: EXECUTE only on these exact signatures (verified with actual local role):

```text
qbo_billing_announcement_dispatch(uuid,text,text,uuid,text,text,jsonb)
qbo_billing_announcement_outcome(uuid,text,text,uuid,jsonb)
qbo_billing_approve_announcement(uuid,text,text,uuid,uuid,uuid,text,jsonb)
qbo_billing_approve_current(uuid,text,text,uuid,text,jsonb,text,uuid)
qbo_billing_attempt_outcome(uuid,text,text,uuid,text,uuid,text,text,text)
qbo_billing_channel_scoped(uuid,text,text,uuid,text)
qbo_billing_claim_announcement(uuid,text,text,uuid)
qbo_billing_claim_scoped(uuid,text,text,uuid)
qbo_billing_client_in_scope(uuid,text,text,uuid)
qbo_billing_create_scoped_client(uuid,text,text,uuid,jsonb,uuid,jsonb)
qbo_billing_delivery_intent(uuid,text,text,uuid,text,text,text,uuid)
qbo_billing_due_announcements(uuid,text,text)
qbo_billing_find_run(uuid,text,text,text)
qbo_billing_host_read(uuid,text,text,text,text,uuid)
qbo_billing_read_approval(uuid,text,text,uuid)
qbo_billing_read_enrollment(uuid,text,text,uuid)
qbo_billing_register_new_client(uuid,text,text,uuid,uuid)
qbo_billing_resolve_evidence(uuid,text,text,uuid,uuid,text,text,jsonb)
qbo_billing_resume_scoped(uuid,text,text,uuid)
qbo_billing_set_enrollment(uuid,text,text,uuid,boolean,text,bigint,uuid)
qbo_billing_source(uuid,text,text,uuid)
qbo_billing_update_run(uuid,text,text,uuid,jsonb)
qbo_billing_verify_mapping(uuid,text,text,uuid,text,uuid)
qbo_billing_verify_provider(uuid,text,text,jsonb,uuid)
```

All other qbo_billing helpers, including claim, claim_channel, assert_run, assert_source,
assert_enrollment/base, admin, sync_config, save_approval, immutable triggers and run_json
have service_role EXECUTE revoked. Scoped functions call helpers as migration-owner.
No new existing-table/global access grant is proposed. Protected host is a trusted boundary:
service RPCs are NOT arbitrary browser-accessible endpoints. Owner reviews SECURITY DEFINER
ownership and explicit search_path=public,extensions. Existing service SDK selects users and
business_members and reads/refreshes ONLY configured environment+realm qbo_connections using
existing grants. Client/profile creation is inside admin-checked scoped transaction, not
unscoped service writes. Separate cron template requires migration-owner registration rights
and existing cron/net/Vault access; no new frontend/public privileges or secret values.
