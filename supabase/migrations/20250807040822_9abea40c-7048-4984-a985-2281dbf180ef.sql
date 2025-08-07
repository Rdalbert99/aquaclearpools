-- Remove unique constraint on email in users table to allow same email for multiple roles
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_email_key;