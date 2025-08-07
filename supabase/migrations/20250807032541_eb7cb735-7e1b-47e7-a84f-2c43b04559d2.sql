-- Add login column to users table
ALTER TABLE public.users ADD COLUMN login character varying;

-- Make login unique
ALTER TABLE public.users ADD CONSTRAINT users_login_unique UNIQUE (login);

-- Update existing users to have a login based on their email (before @ symbol)
UPDATE public.users 
SET login = split_part(email, '@', 1)
WHERE login IS NULL;

-- Make login NOT NULL after populating existing records
ALTER TABLE public.users ALTER COLUMN login SET NOT NULL;