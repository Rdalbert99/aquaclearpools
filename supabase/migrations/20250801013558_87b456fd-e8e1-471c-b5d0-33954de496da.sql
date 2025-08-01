-- Add column to track if user must change password on first login
ALTER TABLE public.users 
ADD COLUMN must_change_password boolean DEFAULT false;