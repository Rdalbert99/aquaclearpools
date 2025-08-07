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
        const { data, error: queryError } = await supabase
          .from('users')
          .select('login')
          .eq('login', username)
          .maybeSingle();

        if (queryError) {
          setError('Error checking username availability');
          setIsAvailable(null);
        } else {
          setIsAvailable(!data); // Available if no user found
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