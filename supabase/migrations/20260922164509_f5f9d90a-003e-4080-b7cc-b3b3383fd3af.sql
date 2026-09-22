ALTER TABLE public.chemical_catalog ADD COLUMN IF NOT EXISTS sku text;

CREATE TABLE public.inventory_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor text,
  invoice_number text,
  invoice_date date,
  subtotal numeric,
  tax numeric,
  total numeric,
  image_path text,
  raw_extraction jsonb,
  notes text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_receipts TO authenticated;
GRANT ALL ON public.inventory_receipts TO service_role;
ALTER TABLE public.inventory_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view inventory receipts" ON public.inventory_receipts
  FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "Staff create inventory receipts" ON public.inventory_receipts
  FOR INSERT TO authenticated WITH CHECK (public.is_staff() AND created_by = auth.uid());
CREATE POLICY "Staff update inventory receipts" ON public.inventory_receipts
  FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "Admins delete inventory receipts" ON public.inventory_receipts
  FOR DELETE TO authenticated USING (public.is_admin_user());

CREATE TABLE public.inventory_receipt_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES public.inventory_receipts(id) ON DELETE CASCADE,
  chemical_id text,
  chemical_label text,
  sku text,
  description text,
  quantity numeric,
  package_size numeric,
  package_unit text,
  unit text,
  base_quantity numeric,
  unit_price numeric,
  line_total numeric,
  purchase_id uuid REFERENCES public.chemical_inventory_purchases(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_receipt_items TO authenticated;
GRANT ALL ON public.inventory_receipt_items TO service_role;
ALTER TABLE public.inventory_receipt_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view inventory receipt items" ON public.inventory_receipt_items
  FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "Staff create inventory receipt items" ON public.inventory_receipt_items
  FOR INSERT TO authenticated WITH CHECK (public.is_staff());
CREATE POLICY "Staff update inventory receipt items" ON public.inventory_receipt_items
  FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "Admins delete inventory receipt items" ON public.inventory_receipt_items
  FOR DELETE TO authenticated USING (public.is_admin_user());

CREATE INDEX idx_inventory_receipt_items_receipt ON public.inventory_receipt_items(receipt_id);
CREATE INDEX idx_inventory_receipts_vendor_invoice ON public.inventory_receipts(lower(coalesce(vendor,'')), lower(coalesce(invoice_number,'')));

CREATE TRIGGER update_inventory_receipts_updated_at
  BEFORE UPDATE ON public.inventory_receipts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();