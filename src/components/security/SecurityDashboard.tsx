import { useSecurityMonitoring } from '@/hooks/useSecurityMonitoring';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export const SecurityDashboard = () => {
  const { 
    metrics, 
    recentEvents, 
    loading, 
    error, 
    isAdmin, 
    refresh 
  } = useSecurityMonitoring();

  if (!isAdmin) {
    return (
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          Access denied. Administrator privileges required to view security dashboard.
        </AlertDescription>
      </Alert>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'critical':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      default:
        return <Shield className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-500';
      case 'warning':
        return 'bg-yellow-500';
      case 'critical':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getSeverityBadge = (severity: string) => {
    const variant = severity === 'error' ? 'destructive' : 
                   severity === 'warning' ? 'secondary' : 'outline';
    return <Badge variant={variant}>{severity}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Security Dashboard</h2>
          <p className="text-muted-foreground">
            Monitor system security health and recent security events
          </p>
        </div>
        <Button onClick={refresh} disabled={loading} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Security Health Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            {metrics && getStatusIcon(metrics.status)}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.status || 'Loading...'}
            </div>
            <div className={`h-2 w-full rounded-full mt-2 ${metrics ? getStatusColor(metrics.status) : 'bg-gray-200'}`} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Logins</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.failedLogins ?? '--'}</div>
            <p className="text-xs text-muted-foreground">Last hour</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rate Limit Violations</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.rateLimitViolations ?? '--'}</div>
            <p className="text-xs text-muted-foreground">Last hour</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalEvents ?? '--'}</div>
            <p className="text-xs text-muted-foreground">Last hour</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Security Events */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Security Events</CardTitle>
          <CardDescription>
            Latest security events and system activities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentEvents.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No recent security events
              </p>
            ) : (
              recentEvents.slice(0, 10).map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{event.event_type}</span>
                      {getSeverityBadge(event.severity)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {event.ip_address && (
                        <span className="mr-4">IP: {event.ip_address}</span>
                      )}
                      {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};