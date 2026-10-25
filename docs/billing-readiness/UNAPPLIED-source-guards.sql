-- THIRD PASS: apply AFTER UNAPPLIED-schema.sql, ONLY after privilege review.
-- No live execution, no billing activation. Table locks deliberately protect missing-row
-- STOP/preferences/mapping phantoms without modifying existing writer code/triggers.
BEGIN;
CREATE TABLE public.qbo_billing_provider_setup (
 business_id uuid NOT NULL, environment text NOT NULL, realm_id text NOT NULL,
 setup jsonb NOT NULL, verified_at timestamptz, PRIMARY KEY(business_id,environment,realm_id)
);
GRANT ALL ON public.qbo_billing_provider_setup TO service_role;
ALTER TABLE public.qbo_billing_provider_setup ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.qbo_billing_annual_config (
 business_id uuid NOT NULL, environment text NOT NULL, realm_id text NOT NULL, client_id uuid NOT NULL,
 config jsonb NOT NULL, PRIMARY KEY(business_id,environment,realm_id,client_id)
);
GRANT ALL ON public.qbo_billing_annual_config TO service_role;
ALTER TABLE public.qbo_billing_annual_config ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.qbo_billing_verified_mapping (
 business_id uuid NOT NULL, environment text NOT NULL, realm_id text NOT NULL, client_id uuid NOT NULL,
 customer_id text NOT NULL, legacy_updated_at timestamptz NOT NULL, verified_at timestamptz NOT NULL,
 revision uuid NOT NULL DEFAULT gen_random_uuid(), PRIMARY KEY(business_id,environment,realm_id,client_id),
 UNIQUE(environment,realm_id,customer_id)
);
GRANT ALL ON public.qbo_billing_verified_mapping TO service_role;
ALTER TABLE public.qbo_billing_verified_mapping ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.qbo_billing_evidence (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL, environment text NOT NULL,
 realm_id text NOT NULL, run_id uuid NOT NULL REFERENCES public.qbo_billing_runs(id),
 actor uuid NOT NULL, kind text NOT NULL, provider_id text NOT NULL, proof jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.qbo_billing_evidence TO service_role;
ALTER TABLE public.qbo_billing_evidence ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER immutable_evidence BEFORE UPDATE OR DELETE ON public.qbo_billing_evidence FOR EACH ROW EXECUTE FUNCTION public.qbo_billing_immutable();
ALTER TABLE public.qbo_billing_runs ADD COLUMN provider_outcomes jsonb NOT NULL DEFAULT '{}';
ALTER TABLE public.qbo_billing_runs ADD COLUMN create_intent boolean NOT NULL DEFAULT false;

CREATE FUNCTION public.qbo_billing_admin(_business uuid,_actor uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
BEGIN
 IF _actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.users u JOIN public.business_members m ON m.user_id=u.id
 WHERE u.id=_actor AND lower(trim(u.role))='admin' AND lower(trim(u.status))='active'
 AND m.business_id=_business AND lower(trim(m.role)) IN ('admin','owner')) THEN RAISE EXCEPTION 'unauthorized'; END IF;
END $$;
CREATE FUNCTION public.qbo_billing_source(_business uuid,_environment text,_realm text,_client uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE c jsonb; p jsonb; o jsonb; m jsonb; v jsonb; a jsonb; s jsonb; e jsonb; raw jsonb; normalized_phone text; held boolean;
BEGIN
 -- Global deterministic lock order. SHARE conflicts with every INSERT/UPDATE/DELETE,
 -- including a first STOP row. Locks end at commit, NOT at external provider completion.
 LOCK TABLE public.clients, public.client_billing_preferences, public.sms_opt_outs,
 public.client_qbo_links, public.qbo_billing_client_scope, public.qbo_billing_enrollment,
 public.qbo_billing_annual_config, public.qbo_billing_provider_setup,
 public.qbo_billing_verified_mapping IN SHARE ROW EXCLUSIVE MODE;
 IF NOT public.qbo_billing_client_in_scope(_business,_environment,_realm,_client) THEN RAISE EXCEPTION 'cross_business'; END IF;
 SELECT to_jsonb(x) INTO c FROM public.clients x WHERE id=_client;
 IF c IS NULL THEN RAISE EXCEPTION 'client_unavailable'; END IF;
 SELECT owner_hold INTO held FROM public.qbo_billing_client_scope WHERE business_id=_business AND environment=_environment AND realm_id=_realm AND client_id=_client;
 SELECT to_jsonb(x) INTO p FROM public.client_billing_preferences x WHERE client_id=_client;
 normalized_phone:=regexp_replace(coalesce(c->>'contact_phone',''),'[^0-9]','','g');
 IF length(normalized_phone)=10 THEN normalized_phone:='1'||normalized_phone; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.phone),'[]'::jsonb) INTO o FROM public.sms_opt_outs x
 WHERE client_id=_client OR regexp_replace(x.phone,'[^0-9]','','g')=normalized_phone;
 SELECT to_jsonb(x) INTO m FROM public.client_qbo_links x WHERE client_id=_client AND environment=_environment;
 SELECT to_jsonb(x) INTO v FROM public.qbo_billing_verified_mapping x WHERE business_id=_business AND environment=_environment AND realm_id=_realm AND client_id=_client;
 SELECT config INTO a FROM public.qbo_billing_annual_config WHERE business_id=_business AND environment=_environment AND realm_id=_realm AND client_id=_client;
 SELECT setup INTO s FROM public.qbo_billing_provider_setup WHERE business_id=_business AND environment=_environment AND realm_id=_realm AND verified_at IS NOT NULL;
 e:=public.qbo_billing_read_enrollment(_business,_environment,_realm,_client);
 raw:=jsonb_build_object('client',c,'pref',p,'stop',o,'mapping',m,'verified',v,'annual',a,'provider',s,'enrollment',e,'hold',held);
 RETURN jsonb_build_object('client',c,'annual',a,'provider',s,'enrollment',e,'choice',p->>'invoice_channel',
 'smsConsent',coalesce(p->>'sms_consent_at','')<>'' AND coalesce(p->>'sms_consent_source','')<>'',
 'smsOptedOut',jsonb_array_length(o)>0,'consentRevision',md5(raw::text),
 'mapping',CASE WHEN v IS NOT NULL AND v->>'customer_id'=m->>'qbo_customer_id' AND
 (v->>'legacy_updated_at')::timestamptz=(m->>'updated_at')::timestamptz THEN jsonb_build_object(
 'businessId',_business,'environment',_environment,'realmId',_realm,'clientId',_client,'customerId',v->>'customer_id','verified',true,'revision',v->>'revision') ELSE NULL END);
END $$;
CREATE FUNCTION public.qbo_billing_assert_source(_business uuid,_environment text,_realm text,_client uuid,_snapshot jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE src jsonb; amount bigint; start_day date; end_day date; annual jsonb; freq text; send_day date; channels jsonb; choice text;
BEGIN
 src:=public.qbo_billing_source(_business,_environment,_realm,_client);
 IF src->>'consentRevision' IS DISTINCT FROM _snapshot->>'consentRevision' THEN RAISE EXCEPTION 'stale_source'; END IF;
 IF lower(trim(src->'client'->>'status')) IS DISTINCT FROM 'active' THEN RAISE EXCEPTION 'inactive'; END IF;
 IF lower(trim(src->'client'->>'customer')) IN ('laken ford ramey','laken ramey') THEN RAISE EXCEPTION 'owner_hold'; END IF;
 start_day:=(_snapshot->>'servicePeriod'||'-01')::date; freq:=_snapshot->>'frequency'; annual:=src->'annual';
 IF annual IS NOT NULL AND annual <> 'null'::jsonb THEN
  IF freq<>'annual' OR annual->>'renewalConfirmed'<>'true' OR annual->>'amountConfirmed'<>'true' OR
  (annual->>'renewalMonth')::int<>extract(month FROM start_day) THEN RAISE EXCEPTION 'annual_review_required'; END IF;
  amount:=(annual->>'amountCents')::bigint; end_day:=(start_day+interval '1 year'-interval '1 day')::date;
 ELSE
  IF _client IN ('208cdcbc-375c-495f-8838-0e1f2003038c','9a8f6dce-bd90-4995-aa91-50664e45d81b','6d228b42-7306-467f-9a9d-89f31ad4f599') THEN RAISE EXCEPTION 'annual_review_required'; END IF;
  IF freq IS DISTINCT FROM 'monthly' THEN RAISE EXCEPTION 'invalid_frequency'; END IF;
  amount:=round((src->'client'->>'service_rate')::numeric*100); end_day:=(start_day+interval '1 month'-interval '1 day')::date;
 END IF;
 IF amount IS NULL OR amount<=0 OR amount IS DISTINCT FROM (_snapshot->>'amountCents')::bigint OR
 _snapshot->>'serviceStart' IS DISTINCT FROM start_day::text OR _snapshot->>'dueDate' IS DISTINCT FROM start_day::text OR
 _snapshot->>'serviceEnd' IS DISTINCT FROM end_day::text THEN RAISE EXCEPTION 'invalid_snapshot'; END IF;
 IF src->'mapping'->>'customerId' IS DISTINCT FROM _snapshot->>'customerId' OR src->'provider' IS DISTINCT FROM _snapshot->'provider' THEN RAISE EXCEPTION 'setup_changed'; END IF;
 IF _snapshot->'channels' IS NULL OR jsonb_array_length(_snapshot->'channels')=0 THEN RAISE EXCEPTION 'missing_channel'; END IF;
 IF _snapshot->'channels' ? 'sms' AND (src->>'smsConsent'<>'true' OR src->>'smsOptedOut'='true' OR coalesce(src->'client'->>'contact_phone','')='') THEN RAISE EXCEPTION 'sms_blocked'; END IF;
 IF _snapshot->'channels' ? 'email' AND coalesce(src->'client'->>'contact_email','')='' THEN RAISE EXCEPTION 'email_blocked'; END IF;
 IF _snapshot->>'contactPhone' IS DISTINCT FROM src->'client'->>'contact_phone' OR _snapshot->>'contactEmail' IS DISTINCT FROM src->'client'->>'contact_email' OR
 _snapshot->>'mappingRevision' IS DISTINCT FROM src->'mapping'->>'revision' THEN RAISE EXCEPTION 'stale_source'; END IF;
 send_day:=start_day-1; send_day:=send_day-((extract(isodow FROM send_day)::int+6)%7);
 IF (_snapshot->>'sendAt')::timestamptz IS DISTINCT FROM ((send_day::text||' 12:00:00')::timestamp AT TIME ZONE 'America/Chicago') THEN RAISE EXCEPTION 'invalid_send_date'; END IF;
 choice:=coalesce(annual->>'channel',src->>'choice','both'); channels:='[]'::jsonb;
 IF choice IN ('email','both') AND coalesce(src->'client'->>'contact_email','')<>'' THEN channels:=channels||'"email"'::jsonb; END IF;
 IF choice IN ('sms','both') AND src->>'smsConsent'='true' AND src->>'smsOptedOut'='false' AND coalesce(src->'client'->>'contact_phone','')<>'' THEN channels:=channels||'"sms"'::jsonb; END IF;
 IF channels IS DISTINCT FROM _snapshot->'channels' THEN RAISE EXCEPTION 'channel_changed'; END IF;
END $$;
CREATE FUNCTION public.qbo_billing_approve_current(_business uuid,_environment text,_realm text,_client uuid,_period text,_snapshot jsonb,_fingerprint text,_actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE rev bigint; a public.qbo_billing_approvals;
BEGIN
 PERFORM public.qbo_billing_admin(_business,_actor);
 PERFORM public.qbo_billing_assert_source(_business,_environment,_realm,_client,_snapshot);
 PERFORM pg_advisory_xact_lock(hashtextextended(_business::text||':'||_environment||':'||_realm||':'||_client::text,0));
 rev:=public.qbo_billing_sync_config(_business,_environment,_realm,_client,_period,_snapshot,_fingerprint,(_snapshot->'enrollment'->>'revision')::bigint);
 a:=public.qbo_billing_save_approval(_business,_environment,_realm,_client,_period,rev,_fingerprint,_actor);
 RETURN public.qbo_billing_read_approval(_business,_environment,_realm,a.id);
END $$;
CREATE FUNCTION public.qbo_billing_register_new_client(_business uuid,_environment text,_realm text,_client uuid,_actor uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$ BEGIN
 PERFORM public.qbo_billing_admin(_business,_actor);
 -- Client rows do not carry business/creator ownership: explicitly reviewed assignment is
 -- mandatory. Never claim an arbitrary global UUID merely because the caller is an admin.
 IF NOT public.qbo_billing_client_in_scope(_business,_environment,_realm,_client) THEN RAISE EXCEPTION 'customer_scope_review_required'; END IF;
 RETURN true;
END $$;
CREATE FUNCTION public.qbo_billing_create_scoped_client(_business uuid,_environment text,_realm text,_actor uuid,_client jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE cols text; expressions text; row_value jsonb; client_id uuid;
BEGIN
 PERFORM public.qbo_billing_admin(_business,_actor);
 IF _environment NOT IN ('sandbox','production') OR _realm !~ '^\d+$' OR NOT EXISTS(SELECT 1 FROM public.businesses WHERE id=_business) THEN RAISE EXCEPTION 'invalid_scope'; END IF;
 IF jsonb_typeof(_client)<>'object' OR coalesce(trim(_client->>'customer'),'')='' THEN RAISE EXCEPTION 'invalid_client'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(_client) k WHERE k NOT IN ('customer','contact_email','contact_phone','contact_address','street_address','city','state','zip_code','address_validated','pool_size','pool_type','liner_type','status','in_balance','last_service_date','user_id','service_rate','service_frequency','next_service_date','included_services','service_notes','service_days','company_name','is_multi_property','join_date','created_at','updated_at')) THEN RAISE EXCEPTION 'invalid_client_field'; END IF;
 SELECT string_agg(format('%I',k),',' ORDER BY k),string_agg(format('(jsonb_populate_record(NULL::public.clients,$1)).%I',k),',' ORDER BY k)
 INTO cols,expressions FROM jsonb_object_keys(_client) k;
 EXECUTE format('INSERT INTO public.clients (%s) SELECT %s RETURNING to_jsonb(clients)',cols,expressions) INTO row_value USING _client;
 client_id:=(row_value->>'id')::uuid;
 INSERT INTO public.qbo_billing_client_scope(business_id,environment,realm_id,client_id) VALUES(_business,_environment,_realm,client_id);
 -- No runtime auto-on; actual-ID separate enrollment save is mandatory.
 RETURN row_value;
END $$;
CREATE FUNCTION public.qbo_billing_verify_mapping(_business uuid,_environment text,_realm text,_client uuid,_customer text,_actor uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$ DECLARE m public.client_qbo_links;
BEGIN
 PERFORM public.qbo_billing_admin(_business,_actor); PERFORM public.qbo_billing_source(_business,_environment,_realm,_client);
 SELECT * INTO m FROM public.client_qbo_links WHERE client_id=_client AND environment=_environment;
 IF NOT FOUND OR m.qbo_customer_id IS DISTINCT FROM _customer OR _customer !~ '^\d{1,20}$' THEN RAISE EXCEPTION 'legacy_mapping_review_required'; END IF;
 INSERT INTO public.qbo_billing_verified_mapping(business_id,environment,realm_id,client_id,customer_id,legacy_updated_at,verified_at)
 VALUES(_business,_environment,_realm,_client,_customer,m.updated_at,now())
 ON CONFLICT(business_id,environment,realm_id,client_id) DO UPDATE SET customer_id=excluded.customer_id,legacy_updated_at=excluded.legacy_updated_at,verified_at=now(),revision=gen_random_uuid();
 RETURN true;
END $$;
CREATE FUNCTION public.qbo_billing_verify_provider(_business uuid,_environment text,_realm text,_setup jsonb,_actor uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$ BEGIN
 PERFORM public.qbo_billing_admin(_business,_actor);
 IF _setup->>'verified' IS DISTINCT FROM 'true' OR _setup->>'taxMode' IS DISTINCT FROM 'non_taxable' OR _setup->>'taxCode' IS DISTINCT FROM 'NON' THEN RAISE EXCEPTION 'tax_review_required'; END IF;
 INSERT INTO public.qbo_billing_provider_setup VALUES(_business,_environment,_realm,_setup,now())
 ON CONFLICT(business_id,environment,realm_id) DO UPDATE SET setup=excluded.setup,verified_at=now(); RETURN true;
END $$;
-- Revalidate ALL real sources at every enrollment guard: approval/create/channel/resume.
-- Rename old internal implementation and replace wrapper, avoiding cached-config-only guards.
ALTER FUNCTION public.qbo_billing_assert_enrollment(uuid,text,text,uuid,jsonb) RENAME TO qbo_billing_assert_enrollment_base;
CREATE FUNCTION public.qbo_billing_assert_enrollment(_business uuid,_environment text,_realm text,_client uuid,_snapshot jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$ BEGIN
 PERFORM public.qbo_billing_assert_source(_business,_environment,_realm,_client,_snapshot);
 PERFORM public.qbo_billing_assert_enrollment_base(_business,_environment,_realm,_client,_snapshot);
END $$;
CREATE FUNCTION public.qbo_billing_record_outcome(_business uuid,_environment text,_realm text,_id uuid,_channel text,_provider_id text,_status text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$ BEGIN
 IF _channel NOT IN ('sms','email') OR _status NOT IN ('sent','failed','unknown') OR _provider_id IS NULL THEN RAISE EXCEPTION 'invalid_outcome'; END IF;
 UPDATE public.qbo_billing_runs SET provider_outcomes=jsonb_set(provider_outcomes,ARRAY[_channel],jsonb_build_object('id',_provider_id,'status',_status))
 WHERE id=_id AND business_id=_business AND environment=_environment AND realm_id=_realm AND channels->>_channel='sending';
 RETURN FOUND;
END $$;
CREATE FUNCTION public.qbo_billing_resolve_evidence(_business uuid,_environment text,_realm text,_id uuid,_actor uuid,_kind text,_provider_id text,_proof jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE r public.qbo_billing_runs; ch text; status text;
BEGIN
 PERFORM public.qbo_billing_admin(_business,_actor);
 SELECT * INTO r FROM public.qbo_billing_runs WHERE id=_id AND business_id=_business AND environment=_environment AND realm_id=_realm FOR UPDATE;
 IF NOT FOUND OR _proof->>'verified' IS DISTINCT FROM 'true' OR _proof->>'runId' IS DISTINCT FROM _id::text THEN RAISE EXCEPTION 'invalid_evidence'; END IF;
 IF _kind='invoice' THEN
  IF _provider_id !~ '^\d+$' OR _proof->>'customerId' IS DISTINCT FROM r.snapshot->>'customerId' OR
  (_proof->>'amountCents')::bigint IS DISTINCT FROM (r.snapshot->>'amountCents')::bigint OR
  _proof->>'serviceStart' IS DISTINCT FROM r.snapshot->>'serviceStart' OR _proof->>'serviceEnd' IS DISTINCT FROM r.snapshot->>'serviceEnd' OR
  _proof->>'dueDate' IS DISTINCT FROM r.snapshot->>'dueDate' OR (r.provider_invoice_id IS NOT NULL AND r.provider_invoice_id<>_provider_id) THEN RAISE EXCEPTION 'evidence_mismatch'; END IF;
  UPDATE public.qbo_billing_runs SET provider_invoice_id=_provider_id,state='created',code='reconciled_invoice' WHERE id=_id;
 ELSIF _kind='delivery' THEN
  ch:=_proof->>'channel'; status:=_proof->>'status';
  IF ch IS NULL OR ch NOT IN ('sms','email') OR status IS NULL OR status NOT IN ('sent','failed') OR
  r.provider_outcomes->ch->>'id' IS DISTINCT FROM _provider_id OR r.channels->>ch NOT IN ('sending','unknown') THEN RAISE EXCEPTION 'evidence_mismatch'; END IF;
  UPDATE public.qbo_billing_runs SET channels=jsonb_set(channels,ARRAY[ch],to_jsonb(status)),state='created',code='reconciled_delivery' WHERE id=_id;
 ELSE RAISE EXCEPTION 'invalid_evidence'; END IF;
 INSERT INTO public.qbo_billing_evidence(business_id,environment,realm_id,run_id,actor,kind,provider_id,proof) VALUES(_business,_environment,_realm,_id,_actor,_kind,_provider_id,_proof);
 RETURN true;
END $$;
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'qbo_billing_%'
 LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature); EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature); END LOOP;
END $$;
REVOKE EXECUTE ON FUNCTION public.qbo_billing_claim(uuid,uuid),public.qbo_billing_claim_channel(uuid,text),public.qbo_billing_save_approval(uuid,text,text,uuid,text,bigint,text,uuid) FROM service_role;
COMMIT;
