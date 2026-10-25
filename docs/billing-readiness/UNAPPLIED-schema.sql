-- REVIEW DRAFT ONLY. NOT under supabase/migrations. DO NOT APPLY automatically.
-- No alteration of existing tables, roles, auth, permissions, billing_mode or schedules.
-- New orchestration records are NOT official invoices; only QuickBooks issues invoices.
BEGIN;
CREATE TABLE public.qbo_billing_config (
  business_id uuid NOT NULL, environment text NOT NULL, realm_id text NOT NULL,
  client_id uuid NOT NULL, service_period text NOT NULL,
  current_snapshot jsonb, revision bigint NOT NULL DEFAULT 1,
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
  IF c.current_snapshot->>'frequency' NOT IN ('annual','monthly') THEN RAISE EXCEPTION 'Invalid type'; END IF;
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
  SELECT * INTO c FROM public.qbo_billing_config WHERE business_id=a.business_id AND environment=a.environment AND realm_id=a.realm_id
    AND client_id=a.client_id AND service_period=a.service_period FOR UPDATE;
  SELECT invoice_enabled AND migration_verified AND deployment_verified AND provider_verified INTO enabled
    FROM public.qbo_billing_activation WHERE business_id=a.business_id AND environment=a.environment AND realm_id=a.realm_id FOR SHARE;
  IF enabled IS DISTINCT FROM true THEN RAISE EXCEPTION 'Disabled'; END IF;
  IF c.revision IS DISTINCT FROM a.config_revision OR c.current_snapshot IS DISTINCT FROM a.snapshot THEN RAISE EXCEPTION 'Stale approval'; END IF;
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
  SELECT * INTO r FROM public.qbo_billing_runs WHERE id=_run FOR UPDATE;
  IF r.id IS NULL OR r.provider_invoice_id IS NULL OR _channel NOT IN ('sms','email')
    OR r.channels->>_channel NOT IN ('pending','failed') THEN RETURN false; END IF;
  UPDATE public.qbo_billing_runs SET channels=jsonb_set(channels,ARRAY[_channel],'"sending"'),updated_at=now() WHERE id=_run;
  INSERT INTO public.qbo_billing_events(business_id,run_id,audit_id,code) VALUES(r.business_id,r.id,r.audit_id,'channel_claimed_'||_channel);
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.qbo_billing_claim_channel(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.qbo_billing_claim_channel(uuid,text) TO service_role;
COMMIT;
-- NO cron.schedule, pg_net, enabled flags, customer seeds or deployment in this file.
-- Prerequisites and further adapter/reconciliation review are documented in README.md.
