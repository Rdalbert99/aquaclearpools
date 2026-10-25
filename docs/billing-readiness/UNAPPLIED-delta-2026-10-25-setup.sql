-- UNAPPLIED DELTA — owner review required before installation. Do not auto-apply.
-- Adds ONE function + ONE audit table. No anon/authenticated grants; service_role EXECUTE only.
-- Purpose: save legacy client_qbo_links AND verified mapping atomically after the server has
-- re-read the live QuickBooks Customer and the admin confirmed supported identity evidence.
-- Removes the chicken-and-egg (legacy link had to pre-exist). Existing qbo_billing_verify_mapping unchanged.
BEGIN;
CREATE TABLE public.qbo_billing_mapping_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL, environment text NOT NULL,
  realm_id text NOT NULL, client_id uuid NOT NULL, customer_id text NOT NULL, actor uuid NOT NULL,
  evidence jsonb NOT NULL, fingerprint text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.qbo_billing_mapping_audit FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.qbo_billing_mapping_audit TO service_role;
ALTER TABLE public.qbo_billing_mapping_audit ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER immutable_mapping_audit BEFORE UPDATE OR DELETE ON public.qbo_billing_mapping_audit
  FOR EACH ROW EXECUTE FUNCTION public.qbo_billing_immutable();

CREATE FUNCTION public.qbo_billing_confirm_mapping(_business uuid,_environment text,_realm text,_client uuid,_customer text,_actor uuid,_evidence jsonb,_fingerprint text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE m public.client_qbo_links; other uuid; lu timestamptz;
BEGIN
  PERFORM public.qbo_billing_admin(_business,_actor);
  PERFORM public.qbo_billing_source(_business,_environment,_realm,_client); -- explicit scope check
  IF _customer !~ '^\d{1,20}$' OR _environment NOT IN ('sandbox','production') OR coalesce(_fingerprint,'')='' THEN RAISE EXCEPTION 'mapping_review_required'; END IF;
  IF coalesce((_evidence->>'supported')::boolean,false) IS NOT TRUE OR coalesce((_evidence->>'active')::boolean,false) IS NOT TRUE THEN RAISE EXCEPTION 'mapping_review_required'; END IF;
  -- Reject a QBO customer already linked to a different app client in this environment.
  SELECT client_id INTO other FROM public.client_qbo_links WHERE environment=_environment AND qbo_customer_id=_customer FOR UPDATE;
  IF other IS NOT NULL AND other<>_client THEN RAISE EXCEPTION 'mapping_conflict'; END IF;
  SELECT * INTO m FROM public.client_qbo_links WHERE client_id=_client AND environment=_environment FOR UPDATE;
  IF FOUND AND m.qbo_customer_id IS DISTINCT FROM _customer THEN RAISE EXCEPTION 'mapping_conflict'; END IF; -- never silently re-point
  IF NOT FOUND THEN
    INSERT INTO public.client_qbo_links(client_id,environment,qbo_customer_id) VALUES(_client,_environment,_customer) RETURNING updated_at INTO lu;
  ELSE lu := m.updated_at; END IF;
  INSERT INTO public.qbo_billing_verified_mapping(business_id,environment,realm_id,client_id,customer_id,legacy_updated_at,verified_at)
  VALUES(_business,_environment,_realm,_client,_customer,lu,now())
  ON CONFLICT(business_id,environment,realm_id,client_id) DO UPDATE SET customer_id=excluded.customer_id,legacy_updated_at=excluded.legacy_updated_at,verified_at=now(),revision=gen_random_uuid();
  INSERT INTO public.qbo_billing_mapping_audit(business_id,environment,realm_id,client_id,customer_id,actor,evidence,fingerprint)
  VALUES(_business,_environment,_realm,_client,_customer,_actor,_evidence,_fingerprint);
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.qbo_billing_confirm_mapping(uuid,text,text,uuid,text,uuid,jsonb,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qbo_billing_confirm_mapping(uuid,text,text,uuid,text,uuid,jsonb,text) TO service_role;
COMMIT;
-- Restricted changes for review: new table qbo_billing_mapping_audit (service_role only),
-- new function qbo_billing_confirm_mapping (service_role EXECUTE only), writes client_qbo_links
-- under SECURITY DEFINER after qbo_billing_admin + qbo_billing_source scope checks. No public grant widening.
