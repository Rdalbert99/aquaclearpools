-- FIX: Foreign key constraint violation on client deletion
-- Issue: invitation_access_log references client_invitations but doesn't cascade on delete
-- This prevents client deletion when there are access log entries

-- 1. Drop the existing foreign key constraint
ALTER TABLE public.invitation_access_log 
DROP CONSTRAINT IF EXISTS invitation_access_log_invitation_id_fkey;

-- 2. Recreate the foreign key with CASCADE on delete
-- This allows access log entries to be automatically cleaned up when invitations are deleted
ALTER TABLE public.invitation_access_log 
ADD CONSTRAINT invitation_access_log_invitation_id_fkey 
FOREIGN KEY (invitation_id) 
REFERENCES public.client_invitations(id) 
ON DELETE CASCADE;

-- 3. Add comment explaining the change
COMMENT ON CONSTRAINT invitation_access_log_invitation_id_fkey ON public.invitation_access_log IS 
'Foreign key to client_invitations with CASCADE delete to allow proper cleanup when invitations are removed';