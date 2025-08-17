-- Security hardening for users table
-- 1) Drop legacy plaintext/duplicate password column
ALTER TABLE public.users DROP COLUMN IF EXISTS password;

-- 2) Tighten INSERT policy so users can only create their own row (id must equal auth.uid())
DROP POLICY IF EXISTS "Authenticated can insert users" ON public.users;
CREATE POLICY "Authenticated can insert their own user row"
ON public.users
FOR INSERT
WITH CHECK (auth.uid() = id);