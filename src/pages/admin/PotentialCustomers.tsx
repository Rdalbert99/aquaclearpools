import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Calendar, 
  MapPin, 
  Phone, 
  Mail, 
  Droplets,
  Search,
  UserPlus,
  Eye
} from 'lucide-react';

interface ServiceRequest {
  id: string;
  request_type: string;
  description: string;
  priority: string;
  status: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  contact_address?: string;
  pool_type?: string;
  pool_size?: string;
  preferred_date?: string;
  requested_date: string;
  client_id?: string;
}

export default function PotentialCustomers() {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadPotentialCustomers();
  }, []);

  const loadPotentialCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('service_requests')
        .select('*')
        .is('client_id', null) // Only requests not linked to existing clients
        .order('requested_date', { ascending: false });

      if (error) {
        console.error('Error loading potential customers:', error);
        return;
      }

      setRequests(data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredRequests = requests.filter(request =>
    request.contact_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.contact_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.contact_phone?.includes(searchTerm) ||
    request.contact_address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.request_type?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <h1 className="text-3xl font-bold">Potential Customers</h1>
          <p className="text-muted-foreground">
            Service requests from people who haven't created accounts yet
          </p>
        </div>
      </div>

      {/* Search and Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Search Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, phone, address, or service type..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Total Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{requests.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">High Priority</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {requests.filter(r => r.priority === 'high' || r.priority === 'emergency').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle>Service Requests</CardTitle>
          <CardDescription>
            Click on any row to view full details and convert to customer
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Pool Info</TableHead>
                <TableHead>Service Needed</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Requested Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests.map((request) => (
                <TableRow key={request.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell>
                    <div>
                      <p className="font-medium">{request.contact_name || 'Unknown'}</p>
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        {request.contact_email && (
                          <div className="flex items-center space-x-1">
                            <Mail className="h-3 w-3" />
                            <span>{request.contact_email}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        {request.contact_phone && (
                          <div className="flex items-center space-x-1">
                            <Phone className="h-3 w-3" />
                            <span>{request.contact_phone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-start space-x-1">
                      <MapPin className="h-3 w-3 mt-1 text-muted-foreground" />
                      <span className="text-sm">{request.contact_address || 'No address'}</span>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="text-sm">
                      <p>{request.pool_type || 'Not specified'}</p>
                      <p className="text-muted-foreground">{request.pool_size || 'Size unknown'}</p>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <p className="text-sm font-medium">{request.request_type}</p>
                  </TableCell>
                  
                  <TableCell>
                    <Badge variant={
                      request.priority === 'emergency' ? 'destructive' :
                      request.priority === 'high' ? 'destructive' :
                      request.priority === 'medium' ? 'default' : 'secondary'
                    }>
                      {request.priority}
                    </Badge>
                  </TableCell>
                  
                  <TableCell>
                    <div className="text-sm">
                      <p>{new Date(request.requested_date).toLocaleDateString()}</p>
                      <p className="text-muted-foreground">
                        {new Date(request.requested_date).toLocaleTimeString()}
                      </p>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button size="sm" variant="outline" asChild>
                        <Link to={`/admin/service-request/${request.id}`}>
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {filteredRequests.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {searchTerm ? 'No requests match your search.' : 'No potential customers found.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}