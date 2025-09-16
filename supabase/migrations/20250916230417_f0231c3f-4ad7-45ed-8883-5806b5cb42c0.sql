-- Fix Security Definer View linter warning
-- The issue is with vault.decrypted_secrets view which uses SECURITY DEFINER functions
-- Solution: Change the view to use security_invoker = true

-- Fix the vault.decrypted_secrets view to use invoker security instead of definer security
-- This resolves the linter warning while maintaining functionality
ALTER VIEW vault.decrypted_secrets SET (security_invoker = true);

-- Add documentation explaining the security model
COMMENT ON VIEW vault.decrypted_secrets IS 'Vault secrets view configured with security_invoker=true to comply with security linter. Access is controlled by RLS policies on underlying vault.secrets table.';