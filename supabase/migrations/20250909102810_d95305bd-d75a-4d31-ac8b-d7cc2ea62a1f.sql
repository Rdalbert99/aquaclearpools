-- Idempotent security hardening patch
-- 1) Ensure DELETE policy exists for reviews
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'reviews' 
      AND policyname = 'Admins only can delete reviews'
  ) THEN
    CREATE POLICY "Admins only can delete reviews"
    ON public.reviews
    FOR DELETE
    TO authenticated
    USING (get_current_user_role() = 'admin');
  END IF;
END$$;

-- 2) Ensure email format constraint on client_invitations exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'email_format_check' 
      AND conrelid = 'public.client_invitations'::regclass
  ) THEN
    ALTER TABLE public.client_invitations
    ADD CONSTRAINT email_format_check
    CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
  END IF;
END$$;
