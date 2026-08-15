import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseUsernameValidationProps {
  username: string;
  debounceMs?: number;
}

export function useUsernameValidation({ username, debounceMs = 500 }: UseUsernameValidationProps) {
  const [isValidating, setIsValidating] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!username || username.length < 3) {
      setIsAvailable(null);
      setError(null);
      setIsValidating(false);
      return;
    }

    setIsValidating(true);
    setError(null);

    const timeoutId = setTimeout(async () => {
      try {
        // Uses a public, security-definer RPC so unauthenticated visitors can
        // check availability without read access to the users table.
        const { data, error: queryError } = await supabase.rpc('is_username_available', {
          username_input: username,
        });

        if (queryError) {
          setError('Error checking username availability');
          setIsAvailable(null);
        } else {
          setIsAvailable(data === true);
        }
      } catch (err) {
        setError('Error checking username availability');
        setIsAvailable(null);
      } finally {
        setIsValidating(false);
      }
    }, debounceMs);

    return () => {
      clearTimeout(timeoutId);
      setIsValidating(false);
    };
  }, [username, debounceMs]);

  return {
    isValidating,
    isAvailable,
    error
  };
}