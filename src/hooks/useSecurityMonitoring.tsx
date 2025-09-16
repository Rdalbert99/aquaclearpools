import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface SecurityMetrics {
  status: 'healthy' | 'warning' | 'critical';
  failedLogins: number;
  rateLimitViolations: number;
  totalEvents: number;
  timestamp: string;
}

interface SecurityEvent {
  id: string;
  event_type: string;
  severity: string;
  created_at: string;
  user_id?: string;
  ip_address?: string;
  payload?: any;
}

interface SecurityHealthResponse {
  status: 'healthy' | 'warning' | 'critical';
  timestamp: string;
  metrics: {
    failed_logins_last_hour: number;
    rate_limit_violations_last_hour: number;
    total_security_events_last_hour: number;
  };
}

export const useSecurityMonitoring = () => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
  const [recentEvents, setRecentEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin';

  const fetchSecurityHealth = async () => {
    if (!isAdmin) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: healthError } = await supabase.rpc('security_health_check');
      
      if (healthError) {
        throw new Error(healthError.message);
      }
      
      if (data) {
        // Type guard for SecurityHealthResponse
        if (typeof data === 'object' && data !== null && 
            'status' in data && 'timestamp' in data && 'metrics' in data) {
          const healthData = data as unknown as SecurityHealthResponse;
          setMetrics({
            status: healthData.status,
            failedLogins: healthData.metrics.failed_logins_last_hour,
            rateLimitViolations: healthData.metrics.rate_limit_violations_last_hour,
            totalEvents: healthData.metrics.total_security_events_last_hour,
            timestamp: healthData.timestamp
          });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch security health');
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentEvents = async (limit: number = 50) => {
    if (!isAdmin) return;
    
    try {
      const { data, error: eventsError } = await supabase
        .from('security_events')
        .select('id, event_type, severity, created_at, user_id, ip_address, payload')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (eventsError) {
        throw new Error(eventsError.message);
      }
      
      if (data) {
        const formattedEvents: SecurityEvent[] = data.map(event => ({
          id: event.id,
          event_type: event.event_type,
          severity: event.severity,
          created_at: event.created_at,
          user_id: event.user_id || undefined,
          ip_address: event.ip_address ? String(event.ip_address) : undefined,
          payload: event.payload
        }));
        setRecentEvents(formattedEvents);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch security events');
    }
  };

  const logSecurityEvent = async (
    eventType: string,
    payload?: any,
    severity: 'info' | 'warning' | 'error' = 'info'
  ) => {
    try {
      await supabase.rpc('log_security_event_enhanced', {
        p_event_type: eventType,
        p_user_id: user?.id || null,
        p_payload: payload || null,
        p_severity: severity
      });
    } catch (err) {
      console.error('Failed to log security event:', err);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchSecurityHealth();
      fetchRecentEvents();
      
      // Set up periodic health checks every 5 minutes
      const interval = setInterval(fetchSecurityHealth, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [isAdmin]);

  return {
    metrics,
    recentEvents,
    loading,
    error,
    isAdmin,
    fetchSecurityHealth,
    fetchRecentEvents,
    logSecurityEvent,
    refresh: () => {
      fetchSecurityHealth();
      fetchRecentEvents();
    }
  };
};