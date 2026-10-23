CREATE TABLE public.client_billing_preferences (
  client_id uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  invoice_channel text CHECK (invoice_channel IN ('sms','email','both')),
  sms_consent_at timestamptz,
  sms_consent_source text,
  set_by text NOT NULL DEFAULT 'customer' CHECK (set_by IN ('customer','admin')),
  override_reason text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.client_billing_preferences TO authenticated;
GRANT ALL ON public.client_billing_preferences TO service_role;
ALTER TABLE public.client_billing_preferences ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.billing_preference_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  old_channel text,
  new_channel text,
  sms_consent boolean,
  changed_by uuid,
  changed_role text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.billing_preference_audit TO authenticated;
GRANT ALL ON public.billing_preference_audit TO service_role;
ALTER TABLE public.billing_preference_audit ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.billing_run_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_key text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('invoice','announcement')),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  service_period_start date,
  service_period_end date,
  amount_cents integer CHECK (amount_cents IS NULL OR amount_cents >= 0),
  frequency text,
  channels text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','excluded','sent','failed')),
  exclusion_reason text,
  note text,
  scheduled_for timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  idempotency_key text NOT NULL UNIQUE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_run_items TO authenticated;
GRANT ALL ON public.billing_run_items TO service_role;
ALTER TABLE public.billing_run_items ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_own_client(_client_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.clients c WHERE c.id = _client_id AND c.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.client_users cu WHERE cu.client_id = _client_id AND cu.user_id = auth.uid()))
$$;

CREATE POLICY "Own or admin read prefs" ON public.client_billing_preferences FOR SELECT TO authenticated
  USING (public.is_admin_user() OR public.is_own_client(client_id));
CREATE POLICY "Block anon prefs" ON public.client_billing_preferences FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "Admin read audit" ON public.billing_preference_audit FOR SELECT TO authenticated USING (public.is_admin_user());
CREATE POLICY "Block anon audit" ON public.billing_preference_audit FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "Admin manage run items" ON public.billing_run_items FOR ALL TO authenticated
  USING (public.is_admin_user()) WITH CHECK (public.is_admin_user() AND status IN ('pending','approved','excluded'));
CREATE POLICY "Block anon run items" ON public.billing_run_items FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE TRIGGER trg_cbp_updated BEFORE UPDATE ON public.client_billing_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_bri_updated BEFORE UPDATE ON public.billing_run_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.client_phone_opted_out(_client_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sms_opt_outs o, public.clients c
    WHERE c.id = _client_id AND (o.client_id = _client_id OR (
      c.contact_phone IS NOT NULL AND length(regexp_replace(c.contact_phone,'\D','','g')) >= 10 AND
      right(regexp_replace(o.phone,'\D','','g'),10) = right(regexp_replace(c.contact_phone,'\D','','g'),10))))
$$;

CREATE OR REPLACE FUNCTION public._apply_invoice_channel(_client_id uuid, _channel text, _sms_consent boolean, _role text, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_old text; v_phone text; v_email text;
BEGIN
  IF _channel IS NOT NULL AND _channel NOT IN ('sms','email','both') THEN RAISE EXCEPTION 'Invalid choice'; END IF;
  SELECT contact_phone, contact_email INTO v_phone, v_email FROM public.clients WHERE id = _client_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found'; END IF;
  IF _channel IN ('sms','both') THEN
    IF coalesce(length(regexp_replace(v_phone,'\D','','g')),0) < 10 THEN RAISE EXCEPTION 'No mobile number on file'; END IF;
    IF public.client_phone_opted_out(_client_id) THEN RAISE EXCEPTION 'This number replied STOP. Text START to re-enable texts first.'; END IF;
    IF _sms_consent IS NOT TRUE THEN RAISE EXCEPTION 'Text consent is required for text invoices'; END IF;
  END IF;
  IF _channel IN ('email','both') AND coalesce(v_email,'') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'No valid email on file'; END IF;
  SELECT invoice_channel INTO v_old FROM public.client_billing_preferences WHERE client_id = _client_id;
  INSERT INTO public.client_billing_preferences(client_id, invoice_channel, sms_consent_at, sms_consent_source, set_by, override_reason, updated_by)
  VALUES (_client_id, _channel, CASE WHEN _sms_consent THEN now() END, CASE WHEN _sms_consent THEN _role || '_portal' END, _role, _reason, auth.uid())
  ON CONFLICT (client_id) DO UPDATE SET invoice_channel = EXCLUDED.invoice_channel,
    sms_consent_at = CASE WHEN _sms_consent THEN coalesce(client_billing_preferences.sms_consent_at, now()) ELSE client_billing_preferences.sms_consent_at END,
    sms_consent_source = coalesce(EXCLUDED.sms_consent_source, client_billing_preferences.sms_consent_source),
    set_by = EXCLUDED.set_by, override_reason = EXCLUDED.override_reason, updated_by = EXCLUDED.updated_by;
  INSERT INTO public.billing_preference_audit(client_id, old_channel, new_channel, sms_consent, changed_by, changed_role, reason)
  VALUES (_client_id, v_old, _channel, _sms_consent, auth.uid(), _role, _reason);
END $$;
REVOKE ALL ON FUNCTION public._apply_invoice_channel(uuid,text,boolean,text,text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_my_invoice_channel(_client_id uuid, _channel text, _sms_consent boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF NOT public.is_own_client(_client_id) THEN RAISE EXCEPTION 'Not your account'; END IF;
  IF _channel IS NULL THEN RAISE EXCEPTION 'Choose Text, Email or Both'; END IF;
  PERFORM public._apply_invoice_channel(_client_id, _channel, _sms_consent, 'customer', NULL);
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_invoice_channel(_client_id uuid, _channel text, _sms_consent_on_file boolean, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF NOT public.is_admin_user() THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF length(trim(coalesce(_reason,''))) < 3 THEN RAISE EXCEPTION 'A reason is required'; END IF;
  PERFORM public._apply_invoice_channel(_client_id, _channel, _sms_consent_on_file, 'admin', trim(_reason));
END $$;

REVOKE ALL ON FUNCTION public.set_my_invoice_channel(uuid,text,boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_invoice_channel(uuid,text,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_invoice_channel(uuid,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_invoice_channel(uuid,text,boolean,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.client_phone_opted_out(uuid) TO authenticated;