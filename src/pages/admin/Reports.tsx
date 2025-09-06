import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { 
  BarChart3, 
  Calendar, 
  DollarSign, 
  Users, 
  Droplets,
  TrendingUp,
  FileBarChart,
  Download
} from 'lucide-react';

interface ReportData {
  totalClients: number;
  activeClients: number;
  totalServices: number;
  monthlyRevenue: number;
  servicesThisMonth: number;
  clientsByPoolType: { type: string; count: number }[];
  recentServices: any[];
  technicianStats: { name: string; services: number }[];
}

export default function Reports() {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('30');
  const { toast } = useToast();

  useEffect(() => {
    loadReportData();
  }, [timeframe]);

  const loadReportData = async () => {
    try {
      const daysAgo = parseInt(timeframe);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);

      // Load clients data
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('*, users!clients_user_id_fkey(name, email)');

      if (clientsError) throw clientsError;

      // Load services data
      const { data: services, error: servicesError } = await supabase
        .from('services')
        .select(`
          *,
          users(name),
          clients(customer, pool_type)
        `)
        .gte('service_date', startDate.toISOString());

      if (servicesError) throw servicesError;

      // Calculate stats
      const totalClients = clients?.length || 0;
      const activeClients = clients?.filter(c => c.status === 'Active').length || 0;
      const totalServices = services?.length || 0;
      const monthlyRevenue = services?.reduce((sum, s) => sum + (s.cost || 0), 0) || 0;

      // Group by pool type
      const poolTypes = clients?.reduce((acc, client) => {
        const type = client.pool_type || 'Unknown';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const clientsByPoolType = Object.entries(poolTypes).map(([type, count]) => ({
        type,
        count
      }));

      // Technician stats
      const techStats = services?.reduce((acc, service) => {
        const techName = service.users?.name || 'Unknown';
        acc[techName] = (acc[techName] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const technicianStats = Object.entries(techStats).map(([name, count]) => ({
        name,
        services: count
      }));

      setReportData({
        totalClients,
        activeClients,
        totalServices,
        monthlyRevenue,
        servicesThisMonth: totalServices,
        clientsByPoolType,
        recentServices: services?.slice(0, 10) || [],
        technicianStats
      });
    } catch (error) {
      console.error('Error loading report data:', error);
      toast({
        title: "Error",
        description: "Failed to load report data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!reportData) return;
    
    const csvContent = [
      ['Metric', 'Value'],
      ['Total Clients', reportData.totalClients],
      ['Active Clients', reportData.activeClients],
      ['Total Services', reportData.totalServices],
      ['Revenue', `$${reportData.monthlyRevenue.toFixed(2)}`],
      ['Services This Period', reportData.servicesThisMonth],
      ['', ''],
      ['Pool Types', ''],
      ...reportData.clientsByPoolType.map(pt => [pt.type, pt.count]),
      ['', ''],
      ['Technician Performance', ''],
      ...reportData.technicianStats.map(ts => [ts.name, ts.services])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pool-service-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center space-x-2">
            <BarChart3 className="h-8 w-8" />
            <span>Business Reports</span>
          </h1>
          <p className="text-muted-foreground">Analytics and insights for your pool service business</p>
        </div>
        <div className="flex items-center space-x-4">
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select timeframe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 3 months</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={exportToCSV} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Users className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{reportData?.totalClients}</p>
                <p className="text-sm text-muted-foreground">Total Clients</p>
                <p className="text-xs text-green-600">
                  {reportData?.activeClients} active
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Droplets className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{reportData?.servicesThisMonth}</p>
                <p className="text-sm text-muted-foreground">Services</p>
                <p className="text-xs text-muted-foreground">
                  Last {timeframe} days
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold">
                  ${reportData?.monthlyRevenue.toFixed(0)}
                </p>
                <p className="text-sm text-muted-foreground">Revenue</p>
                <p className="text-xs text-muted-foreground">
                  Last {timeframe} days
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-8 w-8 text-orange-600" />
              <div>
                <p className="text-2xl font-bold">
                  ${(reportData?.monthlyRevenue / Math.max(reportData?.servicesThisMonth || 1, 1)).toFixed(0)}
                </p>
                <p className="text-sm text-muted-foreground">Avg Service</p>
                <p className="text-xs text-muted-foreground">Per service</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pool Types */}
        <Card>
          <CardHeader>
            <CardTitle>Clients by Pool Type</CardTitle>
            <CardDescription>Distribution of pool types in your client base</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {reportData?.clientsByPoolType.map((poolType) => (
                <div key={poolType.type} className="flex items-center justify-between">
                  <span className="font-medium">{poolType.type}</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-32 bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full" 
                        style={{ 
                          width: `${(poolType.count / (reportData.totalClients || 1)) * 100}%` 
                        }}
                      />
                    </div>
                    <Badge variant="secondary">{poolType.count}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Technician Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Technician Performance</CardTitle>
            <CardDescription>Services completed by each technician</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {reportData?.technicianStats.map((tech) => (
                <div key={tech.name} className="flex items-center justify-between">
                  <span className="font-medium">{tech.name}</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-32 bg-muted rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full" 
                        style={{ 
                          width: `${(tech.services / Math.max(...(reportData.technicianStats.map(t => t.services) || [1]))) * 100}%` 
                        }}
                      />
                    </div>
                    <Badge variant="secondary">{tech.services}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Services */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Services</CardTitle>
          <CardDescription>Latest completed services</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-4 font-medium">Date</th>
                  <th className="text-left p-4 font-medium">Client</th>
                  <th className="text-left p-4 font-medium">Technician</th>
                  <th className="text-left p-4 font-medium">Duration</th>
                  <th className="text-left p-4 font-medium">Cost</th>
                  <th className="text-left p-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {reportData?.recentServices.map((service) => (
                  <tr key={service.id} className="border-b hover:bg-muted/50">
                    <td className="p-4">
                      {new Date(service.service_date).toLocaleDateString()}
                    </td>
                    <td className="p-4 font-medium">
                      {service.clients?.customer || 'Unknown'}
                    </td>
                    <td className="p-4">
                      {service.users?.name || 'Unknown'}
                    </td>
                    <td className="p-4">
                      {service.duration_minutes ? `${service.duration_minutes} min` : '-'}
                    </td>
                    <td className="p-4">
                      {service.cost ? `$${service.cost}` : '-'}
                    </td>
                    <td className="p-4">
                      <Badge variant={service.status === 'completed' ? 'default' : 'secondary'}>
                        {service.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {reportData?.recentServices.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No recent services found
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}