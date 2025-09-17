-- FIX: Email format constraint issue in client_invitations table
-- The current constraint is too restrictive and blocks masked email addresses

-- 1. Drop the duplicate constraints (there are two identical ones)
ALTER TABLE public.client_invitations 
DROP CONSTRAINT IF EXISTS email_format_check;

ALTER TABLE public.client_invitations 
DROP CONSTRAINT IF EXISTS valid_email_format;

-- 2. Create a more flexible constraint that allows both real emails and masked emails
ALTER TABLE public.client_invitations 
ADD CONSTRAINT email_format_flexible CHECK (
  email IS NULL OR 
  email ~* '^[A-Za-z0-9._%+*-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
);

-- 3. Add comment explaining the constraint
COMMENT ON CONSTRAINT email_format_flexible ON public.client_invitations IS 
'Flexible email format validation that allows both real emails and masked emails (with asterisks) for privacy';