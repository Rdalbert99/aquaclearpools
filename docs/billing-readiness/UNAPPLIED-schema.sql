-- REVIEW DRAFT ONLY. NOT under supabase/migrations. DO NOT APPLY automatically.
-- No alteration of existing tables, roles, auth, permissions, billing_mode or schedules.
-- New orchestration records are NOT official invoices; only QuickBooks issues invoices.
BEGIN;
CREATE TABLE public.qbo_billing_config (
  business_id uuid NOT NULL, environment text NOT NULL, realm_id text NOT NULL,
  client_id uuid NOT NULL, service_period text NOT NULL,
  current_snapshot jsonb, canonical_fingerprint text, revision bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (business_id, environment, realm_id, client_id, service_period)
);
GRANT ALL ON public.qbo_billing_config TO service_role;
ALTER TABLE public.qbo_billing_config ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policy or grants: service-only; use existing protected role lookup.
CREATE TABLE public.qbo_billing_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL,
  environment text NOT NULL, realm_id text NOT NULL, client_id uuid NOT NULL,
  service_period text NOT NULL, invoice_type text NOT NULL, snapshot jsonb NOT NULL,
  approved_by uuid NOT NULL, approved_at timestamptz NOT NULL DEFAULT now(),
  fingerprint text NOT NULL, config_revision bigint NOT NULL
);
GRANT ALL ON public.qbo_billing_approvals TO service_role;
ALTER TABLE public.qbo_billing_approvals ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.qbo_billing_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL,
  environment text NOT NULL, realm_id text NOT NULL, client_id uuid NOT NULL,
  service_period text NOT NULL, invoice_type text NOT NULL,
  approval_id uuid NOT NULL REFERENCES public.qbo_billing_approvals(id),
  snapshot jsonb NOT NULL, state text NOT NULL DEFAULT 'claimed',
  request_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(), provider_invoice_id text,
  channels jsonb NOT NULL DEFAULT '{}', audit_id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text, updated_at timestamptz NOT NULL DEFAULT now(),
  -- Stronger collision slot excludes invoice type: monthly and annual mutually exclusive.
  UNIQUE (business_id, environment, realm_id, client_id, service_period),
  UNIQUE (business_id, environment, realm_id, client_id, service_period, invoice_type),
  UNIQUE (business_id, environment, realm_id, provider_invoice_id)
);
GRANT ALL ON public.qbo_billing_runs TO service_role;
ALTER TABLE public.qbo_billing_runs ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.qbo_billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL,
  run_id uuid NOT NULL REFERENCES public.qbo_billing_runs(id), audit_id uuid NOT NULL,
  code text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.qbo_billing_events TO service_role;
ALTER TABLE public.qbo_billing_events ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.qbo_billing_activation (
  business_id uuid NOT NULL, environment text NOT NULL, realm_id text NOT NULL,
  invoice_enabled boolean NOT NULL DEFAULT false,
  announcement_enabled boolean NOT NULL DEFAULT false,
  announcement_hour integer, approved_scope_id uuid,
  migration_verified boolean NOT NULL DEFAULT false,
  deployment_verified boolean NOT NULL DEFAULT false,
  provider_verified boolean NOT NULL DEFAULT false,
  PRIMARY KEY (business_id, environment, realm_id)
);
GRANT ALL ON public.qbo_billing_activation TO service_role;
ALTER TABLE public.qbo_billing_activation ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.qbo_billing_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL,
  environment text NOT NULL, realm_id text NOT NULL, client_id uuid NOT NULL,
  send_day date NOT NULL, channel text NOT NULL, scope_id uuid NOT NULL,
  state text NOT NULL DEFAULT 'pending', audit_id uuid NOT NULL DEFAULT gen_random_uuid(),
  UNIQUE (business_id, environment, realm_id, client_id, send_day, channel)
);
GRANT ALL ON public.qbo_billing_announcements TO service_role;
ALTER TABLE public.qbo_billing_announcements ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.qbo_billing_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, extensions AS $$
BEGIN RAISE EXCEPTION 'Immutable approval/audit record'; END $$;
REVOKE ALL ON FUNCTION public.qbo_billing_immutable() FROM PUBLIC;
CREATE TRIGGER immutable_qbo_approval BEFORE UPDATE OR DELETE ON public.qbo_billing_approvals FOR EACH ROW EXECUTE FUNCTION public.qbo_billing_immutable();
CREATE TRIGGER immutable_qbo_event BEFORE UPDATE OR DELETE ON public.qbo_billing_events FOR EACH ROW EXECUTE FUNCTION public.qbo_billing_immutable();

-- The server recomputes snapshot from authoritative records within its save transaction.
-- Requires scoped admin authorization BEFORE this service-only RPC; never accept raw browser snapshot.
CREATE FUNCTION public.qbo_billing_save_approval(_business uuid, _environment text, _realm text,
  _client uuid, _period text, _expected_revision bigint, _fingerprint text, _actor uuid)
RETURNS public.qbo_billing_approvals LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
DECLARE c public.qbo_billing_config; a public.qbo_billing_approvals;
BEGIN
  SELECT * INTO c FROM public.qbo_billing_config WHERE business_id=_business AND environment=_environment
    AND realm_id=_realm AND client_id=_client AND service_period=_period FOR UPDATE;
  IF c.current_snapshot IS NULL OR c.revision IS DISTINCT FROM _expected_revision OR _actor IS NULL THEN RAISE EXCEPTION 'Stale/unavailable approval'; END IF;
  IF coalesce(c.current_snapshot->>'frequency','') NOT IN ('annual','monthly') THEN RAISE EXCEPTION 'Invalid type'; END IF;
  IF c.canonical_fingerprint IS DISTINCT FROM _fingerprint THEN RAISE EXCEPTION 'Invalid fingerprint'; END IF;
  IF c.current_snapshot->>'businessId' IS DISTINCT FROM _business::text OR c.current_snapshot->>'environment' IS DISTINCT FROM _environment OR c.current_snapshot->>'realmId' IS DISTINCT FROM _realm OR c.current_snapshot->>'clientId' IS DISTINCT FROM _client::text OR c.current_snapshot->>'servicePeriod' IS DISTINCT FROM _period THEN RAISE EXCEPTION 'Scope mismatch'; END IF;
  PERFORM public.qbo_billing_assert_enrollment(_business,_environment,_realm,_client,c.current_snapshot);
  INSERT INTO public.qbo_billing_approvals(business_id,environment,realm_id,client_id,service_period,invoice_type,snapshot,approved_by,fingerprint,config_revision)
    VALUES (_business,_environment,_realm,_client,_period,c.current_snapshot->>'frequency',c.current_snapshot,_actor,_fingerprint,c.revision) RETURNING * INTO a;
  RETURN a;
END $$;
REVOKE ALL ON FUNCTION public.qbo_billing_save_approval(uuid,text,text,uuid,text,bigint,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.qbo_billing_save_approval(uuid,text,text,uuid,text,bigint,text,uuid) TO service_role;

CREATE FUNCTION public.qbo_billing_claim(_approval uuid, _business uuid)
RETURNS public.qbo_billing_runs LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE a public.qbo_billing_approvals; c public.qbo_billing_config; r public.qbo_billing_runs; enabled boolean;
BEGIN
  SELECT * INTO a FROM public.qbo_billing_approvals WHERE id=_approval AND business_id=_business;
  IF a.id IS NULL THEN RAISE EXCEPTION 'Unauthorized approval'; END IF;
  PERFORM public.qbo_billing_assert_enrollment(a.business_id,a.environment,a.realm_id,a.client_id,a.snapshot);
  -- Serialize coverage checks across ALL periods for this customer (annual overlap safety).
  PERFORM pg_advisory_xact_lock(hashtextextended(a.business_id::text||':'||a.environment||':'||a.realm_id||':'||a.client_id::text,0));
  SELECT * INTO c FROM public.qbo_billing_config WHERE business_id=a.business_id AND environment=a.environment AND realm_id=a.realm_id
    AND client_id=a.client_id AND service_period=a.service_period FOR UPDATE;
  SELECT invoice_enabled AND migration_verified AND deployment_verified AND provider_verified INTO enabled
    FROM public.qbo_billing_activation WHERE business_id=a.business_id AND environment=a.environment AND realm_id=a.realm_id FOR SHARE;
  IF enabled IS DISTINCT FROM true THEN RAISE EXCEPTION 'Disabled'; END IF;
  IF c.revision IS DISTINCT FROM a.config_revision OR c.current_snapshot IS DISTINCT FROM a.snapshot THEN RAISE EXCEPTION 'Stale approval'; END IF;
  IF c.canonical_fingerprint IS DISTINCT FROM a.fingerprint THEN RAISE EXCEPTION 'Invalid fingerprint'; END IF;
  IF EXISTS (SELECT 1 FROM public.qbo_billing_runs prior WHERE prior.business_id=a.business_id AND prior.environment=a.environment AND prior.realm_id=a.realm_id AND prior.client_id=a.client_id
    AND (prior.snapshot->>'serviceStart')::date <= (a.snapshot->>'serviceEnd')::date AND (a.snapshot->>'serviceStart')::date <= (prior.snapshot->>'serviceEnd')::date) THEN RETURN NULL; END IF;
  INSERT INTO public.qbo_billing_runs(business_id,environment,realm_id,client_id,service_period,invoice_type,approval_id,snapshot,channels)
    VALUES(a.business_id,a.environment,a.realm_id,a.client_id,a.service_period,a.invoice_type,a.id,a.snapshot,
      (SELECT coalesce(jsonb_object_agg(ch,'pending'), '{}'::jsonb) FROM jsonb_array_elements_text(a.snapshot->'channels') ch))
    ON CONFLICT (business_id,environment,realm_id,client_id,service_period) DO NOTHING RETURNING * INTO r;
  IF r.id IS NOT NULL THEN INSERT INTO public.qbo_billing_events(business_id,run_id,audit_id,code) VALUES(r.business_id,r.id,r.audit_id,'claimed'); END IF;
  RETURN r; -- null on collision: NEVER hand a second worker the first worker's claim.
END $$;
REVOKE ALL ON FUNCTION public.qbo_billing_claim(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.qbo_billing_claim(uuid,uuid) TO service_role;

CREATE FUNCTION public.qbo_billing_claim_channel(_run uuid, _channel text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE r public.qbo_billing_runs;
BEGIN
  SELECT * INTO r FROM public.qbo_billing_runs WHERE id=_run;
  IF r.id IS NULL THEN RETURN false; END IF;
  PERFORM public.qbo_billing_assert_run(r.business_id,r.environment,r.realm_id,_run);
  SELECT * INTO r FROM public.qbo_billing_runs WHERE id=_run FOR UPDATE;
  IF r.id IS NULL OR r.provider_invoice_id IS NULL OR _channel NOT IN ('sms','email')
    OR coalesce(r.channels->>_channel,'') NOT IN ('pending','failed') THEN RETURN false; END IF;
  UPDATE public.qbo_billing_runs SET channels=jsonb_set(channels,ARRAY[_channel],'"sending"'),updated_at=now() WHERE id=_run;
  INSERT INTO public.qbo_billing_events(business_id,run_id,audit_id,code) VALUES(r.business_id,r.id,r.audit_id,'channel_claimed_'||_channel);
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.qbo_billing_claim_channel(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.qbo_billing_claim_channel(uuid,text) TO service_role;
-- Second pass contracts below are also UNAPPLIED.
-- NO cron.schedule, pg_net, enabled flags, customer seeds or deployment in this file.
-- Prerequisites and further adapter/reconciliation review are documented in README.md.

-- Membership is a separately reviewed frozen mapping, NOT a blanket runtime enrollment.
CREATE TABLE public.qbo_billing_client_scope (
  business_id uuid NOT NULL, environment text NOT NULL, realm_id text NOT NULL, client_id uuid NOT NULL,
  owner_hold boolean NOT NULL DEFAULT false, cohort_as_of timestamptz,
  PRIMARY KEY(business_id,environment,realm_id,client_id)
);
GRANT ALL ON public.qbo_billing_client_scope TO service_role;
ALTER TABLE public.qbo_billing_client_scope ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.qbo_billing_enrollment (
  business_id uuid NOT NULL, environment text NOT NULL, realm_id text NOT NULL, client_id uuid NOT NULL,
  enabled boolean NOT NULL DEFAULT false, first_service_period text,
  revision bigint NOT NULL DEFAULT 1, updated_by uuid NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(business_id,environment,realm_id,client_id)
);
GRANT ALL ON public.qbo_billing_enrollment TO service_role;
ALTER TABLE public.qbo_billing_enrollment ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.qbo_billing_enrollment_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL,
  environment text NOT NULL, realm_id text NOT NULL, client_id uuid NOT NULL,
  actor uuid NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now(), old_value jsonb, new_value jsonb NOT NULL
);
GRANT ALL ON public.qbo_billing_enrollment_audit TO service_role;
ALTER TABLE public.qbo_billing_enrollment_audit ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER immutable_enrollment_audit BEFORE UPDATE OR DELETE ON public.qbo_billing_enrollment_audit FOR EACH ROW EXECUTE FUNCTION public.qbo_billing_immutable();

CREATE FUNCTION public.qbo_billing_client_in_scope(_business uuid,_environment text,_realm text,_client uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=public,extensions AS $$
 SELECT EXISTS(SELECT 1 FROM public.qbo_billing_client_scope WHERE business_id=_business AND environment=_environment AND realm_id=_realm AND client_id=_client)
$$;
CREATE FUNCTION public.qbo_billing_read_enrollment(_business uuid,_environment text,_realm text,_client uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public,extensions AS $$
 SELECT jsonb_build_object('enabled',enabled,'firstServicePeriod',first_service_period,'revision',revision,'updatedBy',updated_by,'updatedAt',updated_at)
 FROM public.qbo_billing_enrollment WHERE business_id=_business AND environment=_environment AND realm_id=_realm AND client_id=_client
$$;
CREATE FUNCTION public.qbo_billing_set_enrollment(_business uuid,_environment text,_realm text,_client uuid,_enabled boolean,_first text,_expected bigint,_actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE e public.qbo_billing_enrollment; prior jsonb; held boolean; first_day date; last_day date; send_day date;
BEGIN
 PERFORM public.qbo_billing_admin(_business,_actor);
 PERFORM public.qbo_billing_source(_business,_environment,_realm,_client);
 PERFORM pg_advisory_xact_lock(hashtextextended(_business::text||':'||_environment||':'||_realm||':'||_client::text,0));
 SELECT owner_hold INTO held FROM public.qbo_billing_client_scope WHERE business_id=_business AND environment=_environment AND realm_id=_realm AND client_id=_client FOR UPDATE;
 IF NOT FOUND OR _actor IS NULL THEN RAISE EXCEPTION 'cross_business'; END IF;
 IF _enabled AND (held OR _client='15d8a7d0-769c-4b46-954a-e23f3f07c5d8'::uuid) THEN RAISE EXCEPTION 'owner_hold'; END IF;
 IF _first IS NOT NULL AND _first !~ '^\d{4}-(0[1-9]|1[0-2])$' THEN RAISE EXCEPTION 'invalid_first_month'; END IF;
 IF _enabled THEN
   IF _first IS NULL THEN RAISE EXCEPTION 'invalid_first_month'; END IF;
   first_day:=(_first||'-01')::date;
   last_day:=first_day-1;
   send_day:=last_day-((extract(isodow FROM last_day)::integer+6)%7);
   IF send_day < (now() AT TIME ZONE 'America/Chicago')::date THEN RAISE EXCEPTION 'missed_send_day_review_required'; END IF;
 END IF;
 SELECT * INTO e FROM public.qbo_billing_enrollment WHERE business_id=_business AND environment=_environment AND realm_id=_realm AND client_id=_client FOR UPDATE;
 IF coalesce(e.revision,0) IS DISTINCT FROM _expected THEN RAISE EXCEPTION 'stale_enrollment'; END IF;
 prior:=public.qbo_billing_read_enrollment(_business,_environment,_realm,_client);
 INSERT INTO public.qbo_billing_enrollment(business_id,environment,realm_id,client_id,enabled,first_service_period,revision,updated_by)
 VALUES(_business,_environment,_realm,_client,_enabled,_first,1,_actor)
 ON CONFLICT(business_id,environment,realm_id,client_id) DO UPDATE SET enabled=excluded.enabled,first_service_period=excluded.first_service_period,
 revision=qbo_billing_enrollment.revision+1,updated_by=_actor,updated_at=now();
 -- Changes invalidate every queued approval/config, but never delete/void a provider invoice.
 UPDATE public.qbo_billing_config SET current_snapshot=NULL,canonical_fingerprint=NULL,revision=revision+1
 WHERE business_id=_business AND environment=_environment AND realm_id=_realm AND client_id=_client;
 INSERT INTO public.qbo_billing_enrollment_audit(business_id,environment,realm_id,client_id,actor,old_value,new_value)
 VALUES(_business,_environment,_realm,_client,_actor,prior,public.qbo_billing_read_enrollment(_business,_environment,_realm,_client));
 RETURN public.qbo_billing_read_enrollment(_business,_environment,_realm,_client);
END $$;

-- Shared atomic guard: same advisory lock as enrollment save, held until transaction commit.
CREATE FUNCTION public.qbo_billing_assert_enrollment(_business uuid,_environment text,_realm text,_client uuid,_snapshot jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE e jsonb; held boolean;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(_business::text||':'||_environment||':'||_realm||':'||_client::text,0));
 SELECT owner_hold INTO held FROM public.qbo_billing_client_scope WHERE business_id=_business AND environment=_environment AND realm_id=_realm AND client_id=_client FOR SHARE;
 IF NOT FOUND OR held OR _client='15d8a7d0-769c-4b46-954a-e23f3f07c5d8'::uuid THEN RAISE EXCEPTION 'owner_hold_or_scope'; END IF;
 e:=public.qbo_billing_read_enrollment(_business,_environment,_realm,_client);
 IF e IS NULL OR e->>'enabled' IS DISTINCT FROM 'true' OR e->>'firstServicePeriod' IS NULL OR
   e->>'firstServicePeriod' > _snapshot->>'servicePeriod' OR e IS DISTINCT FROM _snapshot->'enrollment' THEN RAISE EXCEPTION 'stale_enrollment'; END IF;
 IF _snapshot->>'businessId' IS DISTINCT FROM _business::text OR _snapshot->>'environment' IS DISTINCT FROM _environment OR
   _snapshot->>'realmId' IS DISTINCT FROM _realm OR _snapshot->>'clientId' IS DISTINCT FROM _client::text THEN RAISE EXCEPTION 'cross_business'; END IF;
END $$;
CREATE FUNCTION public.qbo_billing_sync_config(_business uuid,_environment text,_realm text,_client uuid,_period text,_snapshot jsonb,_fingerprint text,_enrollment_revision bigint)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE rev bigint;
BEGIN
 PERFORM public.qbo_billing_assert_enrollment(_business,_environment,_realm,_client,_snapshot);
 IF (_snapshot->'enrollment'->>'revision')::bigint IS DISTINCT FROM _enrollment_revision OR _snapshot->>'servicePeriod' IS DISTINCT FROM _period THEN RAISE EXCEPTION 'stale_enrollment'; END IF;
 INSERT INTO public.qbo_billing_config(business_id,environment,realm_id,client_id,service_period,current_snapshot,canonical_fingerprint)
 VALUES(_business,_environment,_realm,_client,_period,_snapshot,_fingerprint)
 ON CONFLICT(business_id,environment,realm_id,client_id,service_period) DO UPDATE SET
 revision=qbo_billing_config.revision+CASE WHEN qbo_billing_config.current_snapshot IS DISTINCT FROM excluded.current_snapshot THEN 1 ELSE 0 END,
 current_snapshot=excluded.current_snapshot,canonical_fingerprint=excluded.canonical_fingerprint RETURNING revision INTO rev;
 RETURN rev;
END $$;
CREATE FUNCTION public.qbo_billing_read_approval(_business uuid,_environment text,_realm text,_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public,extensions AS $$
 SELECT jsonb_build_object('id',id,'snapshot',snapshot,'approvedBy',approved_by,'approvedAt',approved_at,'fingerprint',fingerprint)
 FROM public.qbo_billing_approvals WHERE id=_id AND business_id=_business AND environment=_environment AND realm_id=_realm
$$;
CREATE FUNCTION public.qbo_billing_run_json(_row public.qbo_billing_runs)
RETURNS jsonb LANGUAGE sql SET search_path=public,extensions AS $$
 SELECT CASE WHEN _row.id IS NULL THEN NULL ELSE jsonb_build_object('id',_row.id,'auditId',_row.audit_id,'snapshot',_row.snapshot,'state',_row.state,'requestId',_row.request_id,'providerInvoiceId',_row.provider_invoice_id,'channels',_row.channels) END
$$;
CREATE FUNCTION public.qbo_billing_find_run(_business uuid,_environment text,_realm text,_slot text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public,extensions AS $$
 SELECT public.qbo_billing_run_json(r) FROM public.qbo_billing_runs r WHERE business_id=_business AND environment=_environment AND realm_id=_realm
 AND _slot=business_id::text||':'||environment||':'||realm_id||':'||client_id::text||':'||service_period
$$;
CREATE FUNCTION public.qbo_billing_claim_scoped(_business uuid,_environment text,_realm text,_approval uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE a public.qbo_billing_approvals; r public.qbo_billing_runs;
BEGIN
 SELECT * INTO a FROM public.qbo_billing_approvals WHERE id=_approval AND business_id=_business AND environment=_environment AND realm_id=_realm;
 IF NOT FOUND THEN RAISE EXCEPTION 'cross_business'; END IF;
 PERFORM public.qbo_billing_assert_enrollment(_business,_environment,_realm,a.client_id,a.snapshot);
 IF a.snapshot->>'sendAt' IS NULL OR ((a.snapshot->>'sendAt')::timestamptz AT TIME ZONE 'America/Chicago')::date IS DISTINCT FROM (now() AT TIME ZONE 'America/Chicago')::date THEN RAISE EXCEPTION 'send_day_review_required'; END IF;
 IF (a.snapshot->>'sendAt')::timestamptz > now() THEN RAISE EXCEPTION 'send_time_not_due'; END IF;
 r:=public.qbo_billing_claim(_approval,_business);
 RETURN public.qbo_billing_run_json(r);
END $$;
CREATE FUNCTION public.qbo_billing_assert_run(_business uuid,_environment text,_realm text,_id uuid)
RETURNS public.qbo_billing_runs LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE r public.qbo_billing_runs; c public.qbo_billing_config; active boolean;
BEGIN
 SELECT * INTO r FROM public.qbo_billing_runs WHERE id=_id AND business_id=_business AND environment=_environment AND realm_id=_realm;
 IF NOT FOUND THEN RAISE EXCEPTION 'cross_business'; END IF;
 PERFORM public.qbo_billing_assert_enrollment(_business,_environment,_realm,r.client_id,r.snapshot);
 SELECT invoice_enabled AND migration_verified AND deployment_verified AND provider_verified INTO active FROM public.qbo_billing_activation
 WHERE business_id=_business AND environment=_environment AND realm_id=_realm FOR SHARE;
 IF active IS DISTINCT FROM true THEN RAISE EXCEPTION 'disabled'; END IF;
 SELECT * INTO c FROM public.qbo_billing_config WHERE business_id=_business AND environment=_environment AND realm_id=_realm AND client_id=r.client_id AND service_period=r.service_period FOR SHARE;
 IF c.current_snapshot IS DISTINCT FROM r.snapshot THEN RAISE EXCEPTION 'stale_approval'; END IF;
 RETURN r;
END $$;
CREATE FUNCTION public.qbo_billing_channel_scoped(_business uuid,_environment text,_realm text,_id uuid,_channel text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
BEGIN
 PERFORM public.qbo_billing_assert_run(_business,_environment,_realm,_id);
 RETURN public.qbo_billing_claim_channel(_id,_channel);
END $$;
CREATE FUNCTION public.qbo_billing_resume_scoped(_business uuid,_environment text,_realm text,_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE r public.qbo_billing_runs;
BEGIN
 r:=public.qbo_billing_assert_run(_business,_environment,_realm,_id);
 SELECT * INTO r FROM public.qbo_billing_runs WHERE id=_id FOR UPDATE;
 IF r.provider_invoice_id IS NULL OR r.state NOT IN ('blocked','created') OR EXISTS(SELECT 1 FROM jsonb_each_text(r.channels) ch WHERE ch.value IN ('sending','unknown')) THEN RETURN false; END IF;
 -- Persist resume lock in state; a crash requires restricted reconciliation, no TTL auto-release.
 UPDATE public.qbo_billing_runs SET state='claimed',updated_at=now(),code='resume_claimed' WHERE id=_id;
 INSERT INTO public.qbo_billing_events(business_id,run_id,audit_id,code) VALUES(_business,_id,r.audit_id,'resume_claimed');
 RETURN true;
END $$;
CREATE FUNCTION public.qbo_billing_update_run(_business uuid,_environment text,_realm text,_id uuid,_patch jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE r public.qbo_billing_runs; target text; ch text; outcome text;
BEGIN
 SELECT * INTO r FROM public.qbo_billing_runs WHERE id=_id AND business_id=_business AND environment=_environment AND realm_id=_realm;
 IF NOT FOUND THEN RAISE EXCEPTION 'cross_business'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_business::text||':'||_environment||':'||_realm||':'||r.client_id::text,0));
 SELECT * INTO r FROM public.qbo_billing_runs WHERE id=_id FOR UPDATE;
 target:=coalesce(_patch->>'state',r.state); ch:=_patch->>'channel'; outcome:=_patch->>'channelState';
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(_patch) key WHERE key NOT IN ('state','providerInvoiceId','channel','channelState','code','auditId')) THEN RAISE EXCEPTION 'invalid_patch'; END IF;
 IF target NOT IN ('claimed','created','complete','blocked','reconcile') OR r.state='complete' THEN RAISE EXCEPTION 'invalid_transition'; END IF;
 IF NOT (target=r.state OR (r.state='claimed' AND target IN ('reconcile','created','blocked','complete')) OR
 (r.state='reconcile' AND target='created' AND r.provider_invoice_id IS NULL AND _patch ? 'providerInvoiceId' AND r.code='create_in_flight') OR
 (r.state='created' AND target IN ('blocked','reconcile','complete')) OR (r.state='blocked' AND target='reconcile')) THEN RAISE EXCEPTION 'invalid_transition'; END IF;
 -- Persist external outcomes even if owner disabled during request. NEVER authorize an effect here.
 IF target='reconcile' AND _patch->>'code'='create_in_flight' THEN PERFORM public.qbo_billing_assert_run(_business,_environment,_realm,_id); END IF;
 IF _patch ? 'providerInvoiceId' AND coalesce(_patch->>'providerInvoiceId','') !~ '^[0-9]+$' THEN RAISE EXCEPTION 'invalid_provider_id'; END IF;
 IF _patch ? 'providerInvoiceId' AND (r.provider_invoice_id IS NOT NULL AND r.provider_invoice_id IS DISTINCT FROM _patch->>'providerInvoiceId') THEN RAISE EXCEPTION 'provider_id_immutable'; END IF;
 IF ch IS NOT NULL AND (ch NOT IN ('sms','email') OR outcome IS NULL OR outcome NOT IN ('sent','failed','unknown') OR r.channels->>ch IS DISTINCT FROM 'sending') THEN RAISE EXCEPTION 'invalid_channel_transition'; END IF;
 IF target='complete' AND (r.provider_invoice_id IS NULL OR r.channels='{}'::jsonb) THEN RAISE EXCEPTION 'incomplete_channels'; END IF;
 IF target='complete' AND EXISTS(SELECT 1 FROM jsonb_each_text(r.channels) c WHERE c.value <> 'sent') THEN RAISE EXCEPTION 'incomplete_channels'; END IF;
 UPDATE public.qbo_billing_runs SET state=target,provider_invoice_id=coalesce(provider_invoice_id,_patch->>'providerInvoiceId'),
 channels=CASE WHEN ch IS NULL THEN channels ELSE jsonb_set(channels,ARRAY[ch],to_jsonb(outcome)) END,
 code=coalesce(_patch->>'code',target),updated_at=now() WHERE id=_id;
 INSERT INTO public.qbo_billing_events(business_id,run_id,audit_id,code) VALUES(_business,_id,r.audit_id,coalesce(_patch->>'code',target));
 RETURN true;
END $$;
-- ALL new RPCs remain service-only; protected role resolution occurs before the service gateway.
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN ('qbo_billing_client_in_scope','qbo_billing_read_enrollment','qbo_billing_set_enrollment','qbo_billing_assert_enrollment','qbo_billing_sync_config','qbo_billing_read_approval','qbo_billing_run_json','qbo_billing_find_run','qbo_billing_claim_scoped','qbo_billing_assert_run','qbo_billing_channel_scoped','qbo_billing_resume_scoped','qbo_billing_update_run')
 LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',f.signature); EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature); END LOOP;
END $$;
COMMIT;
-- NO cohort INSERTs, owner-hold release, activation flag update or schedule registration.
