
CREATE TABLE public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  billing_mode text NOT NULL DEFAULT 'off',
  invoice_prefix text NOT NULL DEFAULT 'INV',
  next_invoice_number integer NOT NULL DEFAULT 1001,
  payout_label text,
  timezone text NOT NULL DEFAULT 'America/Chicago',
  branding jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.businesses TO authenticated;
GRANT ALL ON public.businesses TO service_role;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.business_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, user_id)
);
GRANT SELECT ON public.business_members TO authenticated;
GRANT ALL ON public.business_members TO service_role;
ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_business_role(_business uuid, _roles text[] DEFAULT ARRAY['owner','admin'])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.business_members m
    WHERE m.business_id = _business AND m.user_id = auth.uid() AND m.role = ANY(_roles)
  ) AND public.is_admin_user()
$$;

CREATE TABLE public.billing_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  monthly_rate_cents integer NOT NULL DEFAULT 0,
  autopay boolean NOT NULL DEFAULT false,
  processor_customer_id text,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, client_id)
);
GRANT SELECT, INSERT, UPDATE ON public.billing_customers TO authenticated;
GRANT ALL ON public.billing_customers TO service_role;
ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  number text,
  status text NOT NULL DEFAULT 'draft',
  period_start date,
  period_end date,
  issue_date date,
  due_date date,
  subtotal_cents integer NOT NULL DEFAULT 0,
  tax_cents integer NOT NULL DEFAULT 0,
  total_cents integer NOT NULL DEFAULT 0,
  paid_cents integer NOT NULL DEFAULT 0,
  notes text,
  source text NOT NULL DEFAULT 'app',
  locked_at timestamptz,
  void_reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  kind text NOT NULL DEFAULT 'service',
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_cents integer NOT NULL DEFAULT 0,
  amount_cents integer NOT NULL DEFAULT 0,
  tax_cents integer NOT NULL DEFAULT 0,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_lines TO authenticated;
GRANT ALL ON public.invoice_lines TO service_role;
ALTER TABLE public.invoice_lines ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  method text NOT NULL,
  amount_cents integer NOT NULL,
  fee_cents integer NOT NULL DEFAULT 0,
  net_cents integer NOT NULL,
  reference text,
  received_at date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'recorded',
  processor_payment_id text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  amount_cents integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_allocations TO authenticated;
GRANT ALL ON public.payment_allocations TO service_role;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  entry_group uuid NOT NULL,
  account text NOT NULL,
  debit_cents integer NOT NULL DEFAULT 0,
  credit_cents integer NOT NULL DEFAULT 0,
  client_id uuid,
  source_table text NOT NULL,
  source_id uuid NOT NULL,
  memo text,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ledger_entries TO authenticated;
GRANT ALL ON public.ledger_entries TO service_role;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.billing_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  action text NOT NULL,
  target_table text NOT NULL,
  target_id uuid,
  detail jsonb,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.billing_audit_log TO authenticated;
GRANT ALL ON public.billing_audit_log TO service_role;
ALTER TABLE public.billing_audit_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX ON public.invoices (business_id, status);
CREATE INDEX ON public.invoices (client_id);
CREATE INDEX ON public.invoice_lines (invoice_id);
CREATE INDEX ON public.payments (business_id, client_id);
CREATE INDEX ON public.ledger_entries (business_id, created_at);

-- Policies
CREATE POLICY "Members view businesses" ON public.businesses FOR SELECT TO authenticated USING (public.has_business_role(id, ARRAY['owner','admin','viewer']));
CREATE POLICY "Owners update businesses" ON public.businesses FOR UPDATE TO authenticated USING (public.has_business_role(id, ARRAY['owner','admin'])) WITH CHECK (public.has_business_role(id, ARRAY['owner','admin']));
CREATE POLICY "Members view membership" ON public.business_members FOR SELECT TO authenticated USING (public.has_business_role(business_id, ARRAY['owner','admin','viewer']));

CREATE POLICY "Members view billing customers" ON public.billing_customers FOR SELECT TO authenticated USING (public.has_business_role(business_id, ARRAY['owner','admin','viewer']));
CREATE POLICY "Admins add billing customers" ON public.billing_customers FOR INSERT TO authenticated WITH CHECK (public.has_business_role(business_id));
CREATE POLICY "Admins edit billing customers" ON public.billing_customers FOR UPDATE TO authenticated USING (public.has_business_role(business_id)) WITH CHECK (public.has_business_role(business_id));

CREATE POLICY "Members view invoices" ON public.invoices FOR SELECT TO authenticated USING (public.has_business_role(business_id, ARRAY['owner','admin','viewer']));
CREATE POLICY "Admins create draft invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK (public.has_business_role(business_id) AND status = 'draft' AND locked_at IS NULL AND number IS NULL AND paid_cents = 0);
CREATE POLICY "Admins edit draft invoices" ON public.invoices FOR UPDATE TO authenticated USING (public.has_business_role(business_id) AND status = 'draft') WITH CHECK (public.has_business_role(business_id) AND status = 'draft' AND locked_at IS NULL AND number IS NULL AND paid_cents = 0);
CREATE POLICY "Admins delete draft invoices" ON public.invoices FOR DELETE TO authenticated USING (public.has_business_role(business_id) AND status = 'draft');

CREATE POLICY "Members view invoice lines" ON public.invoice_lines FOR SELECT TO authenticated USING (public.has_business_role(business_id, ARRAY['owner','admin','viewer']));
CREATE POLICY "Admins add draft lines" ON public.invoice_lines FOR INSERT TO authenticated WITH CHECK (public.has_business_role(business_id) AND EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.status = 'draft' AND i.business_id = invoice_lines.business_id));
CREATE POLICY "Admins edit draft lines" ON public.invoice_lines FOR UPDATE TO authenticated USING (public.has_business_role(business_id) AND EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.status = 'draft')) WITH CHECK (public.has_business_role(business_id) AND EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.status = 'draft' AND i.business_id = invoice_lines.business_id));
CREATE POLICY "Admins delete draft lines" ON public.invoice_lines FOR DELETE TO authenticated USING (public.has_business_role(business_id) AND EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.status = 'draft'));

CREATE POLICY "Members view payments" ON public.payments FOR SELECT TO authenticated USING (public.has_business_role(business_id, ARRAY['owner','admin','viewer']));
CREATE POLICY "Members view allocations" ON public.payment_allocations FOR SELECT TO authenticated USING (public.has_business_role(business_id, ARRAY['owner','admin','viewer']));
CREATE POLICY "Members view ledger" ON public.ledger_entries FOR SELECT TO authenticated USING (public.has_business_role(business_id, ARRAY['owner','admin','viewer']));
CREATE POLICY "Members view billing audit" ON public.billing_audit_log FOR SELECT TO authenticated USING (public.has_business_role(business_id, ARRAY['owner','admin','viewer']));

-- Locked-invoice guard: issued invoices can only change through the billing functions.
CREATE OR REPLACE FUNCTION public.guard_locked_invoice()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, extensions AS $$
BEGIN
  IF coalesce(current_setting('billing.rpc', true), '') = '1' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP IN ('UPDATE','DELETE') AND OLD.locked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Issued invoices cannot be changed; use a void or credit instead';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER trg_guard_locked_invoice BEFORE UPDATE OR DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.guard_locked_invoice();

CREATE OR REPLACE FUNCTION public.block_ledger_changes()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, extensions AS $$
BEGIN
  RAISE EXCEPTION 'This record is permanent and cannot be changed or deleted';
END $$;
CREATE TRIGGER trg_ledger_immutable BEFORE UPDATE OR DELETE ON public.ledger_entries FOR EACH ROW EXECUTE FUNCTION public.block_ledger_changes();
CREATE TRIGGER trg_billing_audit_immutable BEFORE UPDATE OR DELETE ON public.billing_audit_log FOR EACH ROW EXECUTE FUNCTION public.block_ledger_changes();
CREATE TRIGGER trg_payments_immutable BEFORE DELETE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.block_ledger_changes();
CREATE TRIGGER trg_alloc_immutable BEFORE UPDATE OR DELETE ON public.payment_allocations FOR EACH ROW EXECUTE FUNCTION public.block_ledger_changes();

CREATE TRIGGER trg_businesses_updated BEFORE UPDATE ON public.businesses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_billing_customers_updated BEFORE UPDATE ON public.billing_customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Issue an invoice: recompute totals, number it, lock it, post to the ledger.
CREATE OR REPLACE FUNCTION public.billing_issue_invoice(_invoice_id uuid, _due_date date DEFAULT NULL)
RETURNS public.invoices LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE inv public.invoices; biz public.businesses; grp uuid := gen_random_uuid();
  v_sub integer; v_tax integer; v_service integer; v_other integer;
BEGIN
  SELECT * INTO inv FROM public.invoices WHERE id = _invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF NOT public.has_business_role(inv.business_id) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF inv.status <> 'draft' THEN RAISE EXCEPTION 'Only drafts can be issued'; END IF;

  SELECT coalesce(sum(amount_cents),0), coalesce(sum(tax_cents),0),
         coalesce(sum(amount_cents) FILTER (WHERE kind = 'service'),0),
         coalesce(sum(amount_cents) FILTER (WHERE kind <> 'service'),0)
    INTO v_sub, v_tax, v_service, v_other FROM public.invoice_lines WHERE invoice_id = inv.id;
  IF v_sub + v_tax <= 0 THEN RAISE EXCEPTION 'Invoice total must be greater than zero'; END IF;

  SELECT * INTO biz FROM public.businesses WHERE id = inv.business_id FOR UPDATE;
  UPDATE public.businesses SET next_invoice_number = next_invoice_number + 1 WHERE id = biz.id;

  PERFORM set_config('billing.rpc', '1', true);
  UPDATE public.invoices SET
    number = biz.invoice_prefix || '-' || biz.next_invoice_number,
    status = 'open', subtotal_cents = v_sub, tax_cents = v_tax, total_cents = v_sub + v_tax,
    issue_date = CURRENT_DATE, due_date = coalesce(_due_date, due_date, CURRENT_DATE + 15),
    locked_at = now()
  WHERE id = inv.id RETURNING * INTO inv;

  INSERT INTO public.ledger_entries (business_id, entry_group, account, debit_cents, credit_cents, client_id, source_table, source_id, memo, actor_id) VALUES
    (inv.business_id, grp, 'Accounts Receivable', inv.total_cents, 0, inv.client_id, 'invoices', inv.id, 'Invoice ' || inv.number, auth.uid());
  IF v_service > 0 THEN INSERT INTO public.ledger_entries (business_id, entry_group, account, debit_cents, credit_cents, client_id, source_table, source_id, memo, actor_id) VALUES
    (inv.business_id, grp, 'Service Revenue', 0, v_service, inv.client_id, 'invoices', inv.id, 'Invoice ' || inv.number, auth.uid()); END IF;
  IF v_other > 0 THEN INSERT INTO public.ledger_entries (business_id, entry_group, account, debit_cents, credit_cents, client_id, source_table, source_id, memo, actor_id) VALUES
    (inv.business_id, grp, 'Chemical/Parts Revenue', 0, v_other, inv.client_id, 'invoices', inv.id, 'Invoice ' || inv.number, auth.uid()); END IF;
  IF v_tax > 0 THEN INSERT INTO public.ledger_entries (business_id, entry_group, account, debit_cents, credit_cents, client_id, source_table, source_id, memo, actor_id) VALUES
    (inv.business_id, grp, 'Sales Tax Payable', 0, v_tax, inv.client_id, 'invoices', inv.id, 'Invoice ' || inv.number, auth.uid()); END IF;

  INSERT INTO public.billing_audit_log (business_id, action, target_table, target_id, detail, actor_id)
  VALUES (inv.business_id, 'invoice_issued', 'invoices', inv.id, jsonb_build_object('number', inv.number, 'total_cents', inv.total_cents), auth.uid());
  RETURN inv;
END $$;

-- Void an unpaid issued invoice with a reversing ledger entry.
CREATE OR REPLACE FUNCTION public.billing_void_invoice(_invoice_id uuid, _reason text)
RETURNS public.invoices LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE inv public.invoices; grp uuid := gen_random_uuid();
BEGIN
  SELECT * INTO inv FROM public.invoices WHERE id = _invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF NOT public.has_business_role(inv.business_id) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF inv.status <> 'open' THEN RAISE EXCEPTION 'Only open invoices can be voided'; END IF;
  IF inv.paid_cents > 0 THEN RAISE EXCEPTION 'Invoice has payments applied; issue a credit instead'; END IF;
  IF coalesce(trim(_reason), '') = '' THEN RAISE EXCEPTION 'A reason is required'; END IF;

  INSERT INTO public.ledger_entries (business_id, entry_group, account, debit_cents, credit_cents, client_id, source_table, source_id, memo, actor_id)
  SELECT business_id, grp, account, credit_cents, debit_cents, client_id, source_table, source_id, 'VOID ' || coalesce(memo,''), auth.uid()
  FROM public.ledger_entries WHERE source_table = 'invoices' AND source_id = inv.id;

  PERFORM set_config('billing.rpc', '1', true);
  UPDATE public.invoices SET status = 'void', void_reason = _reason WHERE id = inv.id RETURNING * INTO inv;
  INSERT INTO public.billing_audit_log (business_id, action, target_table, target_id, detail, actor_id)
  VALUES (inv.business_id, 'invoice_voided', 'invoices', inv.id, jsonb_build_object('reason', _reason), auth.uid());
  RETURN inv;
END $$;

-- Record a manual (cash/check/other) payment and apply it to invoices.
CREATE OR REPLACE FUNCTION public.billing_record_payment(
  _business_id uuid, _client_id uuid, _method text, _amount_cents integer,
  _reference text, _received_at date, _notes text, _allocations jsonb)
RETURNS public.payments LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE pay public.payments; grp uuid := gen_random_uuid(); a jsonb; inv public.invoices; amt integer; applied integer := 0;
BEGIN
  IF NOT public.has_business_role(_business_id) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF _method NOT IN ('cash','check','other') THEN RAISE EXCEPTION 'Manual payments must be cash, check or other'; END IF;
  IF _amount_cents IS NULL OR _amount_cents <= 0 THEN RAISE EXCEPTION 'Amount must be greater than zero'; END IF;
  IF _method = 'check' AND coalesce(trim(_reference),'') = '' THEN RAISE EXCEPTION 'Check number is required'; END IF;

  INSERT INTO public.payments (business_id, client_id, method, amount_cents, fee_cents, net_cents, reference, received_at, notes, created_by)
  VALUES (_business_id, _client_id, _method, _amount_cents, 0, _amount_cents, nullif(trim(_reference),''), coalesce(_received_at, CURRENT_DATE), _notes, auth.uid())
  RETURNING * INTO pay;

  PERFORM set_config('billing.rpc', '1', true);
  FOR a IN SELECT * FROM jsonb_array_elements(coalesce(_allocations, '[]'::jsonb)) LOOP
    amt := (a->>'amount_cents')::integer;
    CONTINUE WHEN amt IS NULL OR amt <= 0;
    SELECT * INTO inv FROM public.invoices WHERE id = (a->>'invoice_id')::uuid FOR UPDATE;
    IF NOT FOUND OR inv.business_id <> _business_id OR inv.client_id <> _client_id THEN RAISE EXCEPTION 'Invoice does not belong to this customer'; END IF;
    IF inv.status <> 'open' THEN RAISE EXCEPTION 'Invoice % is not open', inv.number; END IF;
    IF amt > inv.total_cents - inv.paid_cents THEN RAISE EXCEPTION 'Amount exceeds balance on %', inv.number; END IF;
    INSERT INTO public.payment_allocations (payment_id, invoice_id, business_id, amount_cents) VALUES (pay.id, inv.id, _business_id, amt);
    UPDATE public.invoices SET paid_cents = paid_cents + amt,
      status = CASE WHEN paid_cents + amt >= total_cents THEN 'paid' ELSE status END
    WHERE id = inv.id;
    applied := applied + amt;
  END LOOP;
  IF applied > _amount_cents THEN RAISE EXCEPTION 'Applied amount exceeds payment'; END IF;

  INSERT INTO public.ledger_entries (business_id, entry_group, account, debit_cents, credit_cents, client_id, source_table, source_id, memo, actor_id) VALUES
    (_business_id, grp, 'Undeposited Funds', _amount_cents, 0, _client_id, 'payments', pay.id, initcap(_method) || coalesce(' #' || pay.reference, ''), auth.uid()),
    (_business_id, grp, 'Accounts Receivable', 0, applied, _client_id, 'payments', pay.id, 'Applied to invoices', auth.uid());
  IF _amount_cents > applied THEN
    INSERT INTO public.ledger_entries (business_id, entry_group, account, debit_cents, credit_cents, client_id, source_table, source_id, memo, actor_id) VALUES
      (_business_id, grp, 'Customer Credits', 0, _amount_cents - applied, _client_id, 'payments', pay.id, 'Unapplied payment', auth.uid());
  END IF;

  INSERT INTO public.billing_audit_log (business_id, action, target_table, target_id, detail, actor_id)
  VALUES (_business_id, 'payment_recorded', 'payments', pay.id, jsonb_build_object('method', _method, 'amount_cents', _amount_cents, 'applied_cents', applied), auth.uid());
  RETURN pay;
END $$;

REVOKE ALL ON FUNCTION public.billing_issue_invoice(uuid, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.billing_void_invoice(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.billing_record_payment(uuid, uuid, text, integer, text, date, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_business_role(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.billing_issue_invoice(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.billing_void_invoice(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.billing_record_payment(uuid, uuid, text, integer, text, date, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_business_role(uuid, text[]) TO authenticated;

-- Seed Aqua Clear as business #1 with current admins as owners.
INSERT INTO public.businesses (name, slug, invoice_prefix, payout_label)
VALUES ('Aqua Clear Pools', 'aqua-clear', 'AC', 'Aqua Clear operating account');
INSERT INTO public.business_members (business_id, user_id, role)
SELECT b.id, u.id, 'owner' FROM public.businesses b, public.users u
WHERE b.slug = 'aqua-clear' AND u.role = 'admin'
ON CONFLICT DO NOTHING;
