import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { 
  Settings, 
  Plus, 
  ArrowLeft,
  Mail,
  Phone,
  User,
  Calendar,
  Wrench
} from 'lucide-react';

interface TechUser {
  id: string;
  name: string;
  login: string;
  email: string;
  phone?: string;
  created_at: string;
  last_login?: string;
}

export default function ManageTechs() {
  const [techs, setTechs] = useState<TechUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTechs();
  }, []);

  const loadTechs = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, login, email, phone, created_at')
        .eq('role', 'tech')
        .order('name');

      if (error) throw error;
      setTechs(data || []);
    } catch (error) {
      console.error('Error loading techs:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Settings className="h-8 w-8" />
              Manage Technicians
            </h1>
            <p className="text-muted-foreground">
              View and manage technician user accounts
            </p>
          </div>
        </div>
        <Button asChild>
          <Link to="/admin/users/new?role=tech">
            <Plus className="h-4 w-4 mr-2" />
            Add New Technician
          </Link>
        </Button>
      </div>

      {/* Stats Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Technician Overview
          </CardTitle>
          <CardDescription>
            Total technicians: {techs.length}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Techs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {techs.map((tech) => (
          <Card key={tech.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {tech.name}
              </CardTitle>
              <CardDescription>
                <Badge variant="outline" className="w-fit">
                  <Wrench className="h-3 w-3 mr-1" />
                  Technician
                </Badge>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Username:</span>
                  <span>{tech.login}</span>
                </div>
                
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Email:</span>
                  <span className="truncate">{tech.email}</span>
                </div>
                
                {tech.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Phone:</span>
                    <span>{tech.phone}</span>
                  </div>
                )}
                
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Created:</span>
                  <span>{new Date(tech.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="pt-3 border-t">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1">
                    Reset Password
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {techs.length === 0 && (
          <div className="col-span-full text-center py-12">
            <Settings className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Technicians Found</h3>
            <p className="text-muted-foreground mb-4">
              Get started by adding the first technician to your system.
            </p>
            <Button asChild>
              <Link to="/admin/users/new?role=tech">
                <Plus className="h-4 w-4 mr-2" />
                Add First Technician
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}