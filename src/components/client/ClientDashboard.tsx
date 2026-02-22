import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { 
  ExternalLink, 
  Calendar, 
  Camera, 
  Droplets,
  Clock,
  TestTube
} from "lucide-react";
import { isInRange } from "@/lib/pool-chemistry";

type Client = {
  id: string;
  customer: string;
  qb_invoice_link?: string | null;
  pool_type?: string;
  pool_size?: number;
  status?: string;
};

type Service = {
  id: string;
  service_date: string;
  performed_at?: string;
  notes?: string;
  chemicals_added?: string;
  before_photo_url?: string;
  after_photo_url?: string;
  duration_minutes?: number;
  readings?: any;
  actions?: any;
  message_preview?: string;
  users?: {
    name: string;
  };
};

export default function ClientDashboard({ clientId }: { clientId: string }) {
  const [client, setClient] = useState<Client | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, [clientId]);

  async function fetchData() {
    setLoading(true);
    try {
      // Fetch client data
      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .maybeSingle();

      if (clientError) throw clientError;
      setClient(clientData);

      // Fetch services data with technician info
      const { data: servicesData, error: servicesError } = await supabase
        .from("services")
        .select(`
          *,
          users!services_technician_id_fkey (
            name
          )
        `)
        .eq("client_id", clientId)
        .order("performed_at", { ascending: false })
        .limit(10);

      if (servicesError) throw servicesError;
      setServices(servicesData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  function getReadingCards(readings: any, poolType?: string) {
    if (!readings) return null;
    const cards: { label: string; value: string; chemId: 'ph' | 'alkalinity' | 'chlorine' | 'cya' | 'salt'; color: string }[] = [];
    
    if (readings.ph != null) cards.push({ label: 'pH', value: String(readings.ph), chemId: 'ph', color: 'from-blue-500/20 to-blue-600/20 border-blue-500/30' });
    if (readings.fc != null) cards.push({ label: 'Free Chlorine', value: `${readings.fc} ppm`, chemId: 'chlorine', color: 'from-cyan-500/20 to-cyan-600/20 border-cyan-500/30' });
    if (readings.ta != null) cards.push({ label: 'Alkalinity', value: `${readings.ta} ppm`, chemId: 'alkalinity', color: 'from-violet-500/20 to-violet-600/20 border-violet-500/30' });
    if (readings.cya != null) cards.push({ label: 'CYA', value: `${readings.cya} ppm`, chemId: 'cya', color: 'from-amber-500/20 to-amber-600/20 border-amber-500/30' });
    if (readings.salt != null && (poolType?.toLowerCase().includes('salt') || true)) {
      cards.push({ label: 'Salt', value: `${readings.salt} ppm`, chemId: 'salt', color: 'from-emerald-500/20 to-emerald-600/20 border-emerald-500/30' });
    }
    
    return cards.length > 0 ? cards : null;
  }

  function formatActions(actions: any) {
    if (!actions) return null;
    const performed = [];
    if (actions.brushed) performed.push('Brushed');
    if (actions.vacuumed) performed.push('Vacuumed');
    if (actions.cleaned_filters) performed.push('Cleaned Filters');
    if (actions.robot_plugged_in) performed.push('Robot Plugged In');
    return performed.join(', ');
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Client not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Droplets className="h-8 w-8" />
            Welcome {client.customer}
          </h1>
          <p className="text-muted-foreground mt-1">
            {client.pool_size ? `${client.pool_size.toLocaleString()} gallon` : ''} {client.pool_type} pool
          </p>
        </div>
        <Badge variant={client.status === 'Active' ? 'default' : 'secondary'}>
          {client.status || 'Active'}
        </Badge>
      </div>

      {/* Invoice Link */}
      {client.qb_invoice_link && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Invoice Ready</h3>
                <p className="text-sm text-muted-foreground">
                  Your invoice is ready for payment
                </p>
              </div>
              <Button asChild>
                <a
                  href={client.qb_invoice_link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Pay Invoice
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Services */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Recent Services
          </CardTitle>
          <CardDescription>
            Your latest pool service visits and maintenance
          </CardDescription>
        </CardHeader>
        <CardContent>
          {services.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No services recorded yet
            </div>
          ) : (
            <div className="space-y-4">
              {services.map((service) => (
                <Card key={service.id} className="border-l-4 border-l-primary">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar className="h-4 w-4" />
                          <span className="font-medium">
                            {new Date(service.performed_at || service.service_date).toLocaleDateString()}
                          </span>
                          {service.duration_minutes && (
                            <>
                              <Clock className="h-4 w-4 ml-2" />
                              <span className="text-sm text-muted-foreground">
                                {service.duration_minutes} min
                              </span>
                            </>
                          )}
                        </div>
                        {service.users?.name && (
                          <p className="text-sm text-muted-foreground">
                            Technician: {service.users.name}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Service Message */}
                    {service.message_preview && (
                      <div className="mb-3 p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm">{service.message_preview}</p>
                      </div>
                    )}

                    {/* Water Readings */}
                    {(() => {
                      const cards = getReadingCards(service.readings, client?.pool_type);
                      if (!cards) return null;
                      return (
                        <div className="mb-3">
                          <div className="flex items-center gap-2 mb-2">
                            <TestTube className="h-4 w-4" />
                            <span className="text-sm font-medium">Water Chemistry</span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                            {cards.map((card) => {
                              const raw = service.readings?.[card.chemId === 'chlorine' ? 'fc' : card.chemId === 'alkalinity' ? 'ta' : card.chemId];
                              const status = isInRange(card.chemId, raw);
                              const statusBorder = status === 'in' ? 'border-green-500/50' : status === 'out' ? 'border-red-500/50' : card.color.split(' ').pop();
                              const statusDot = status === 'in' ? 'bg-green-500' : status === 'out' ? 'bg-red-500' : 'bg-muted';
                              return (
                                <div
                                  key={card.chemId}
                                  className={`rounded-lg border bg-gradient-to-br ${card.color} ${statusBorder} p-3 text-center`}
                                >
                                  <div className="flex items-center justify-center gap-1.5 mb-1">
                                    <div className={`w-2 h-2 rounded-full ${statusDot}`} />
                                    <span className="text-xs font-medium text-muted-foreground">{card.label}</span>
                                  </div>
                                  <span className="text-lg font-bold">{card.value}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Actions Performed */}
                    {formatActions(service.actions) && (
                      <div className="mb-2">
                        <span className="text-sm font-medium">Performed: </span>
                        <span className="text-sm text-muted-foreground">
                          {formatActions(service.actions)}
                        </span>
                      </div>
                    )}

                    {/* Chemicals Added */}
                    {service.chemicals_added && (
                      <div className="mb-2">
                        <span className="text-sm font-medium">Chemicals: </span>
                        <span className="text-sm text-muted-foreground">
                          {service.chemicals_added}
                        </span>
                      </div>
                    )}

                    {/* Notes */}
                    {service.notes && (
                      <div className="mb-3">
                        <span className="text-sm font-medium">Notes: </span>
                        <span className="text-sm text-muted-foreground">
                          {service.notes}
                        </span>
                      </div>
                    )}

                    {/* Photos */}
                    {(service.before_photo_url || service.after_photo_url) && (
                      <div className="flex items-center gap-2 mb-2">
                        <Camera className="h-4 w-4" />
                        <span className="text-sm font-medium">Photos:</span>
                      </div>
                    )}
                    
                    <div className="flex gap-4">
                      {service.before_photo_url && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Before</p>
                          <img
                            src={service.before_photo_url}
                            alt="Before service"
                            className="w-24 h-24 object-cover rounded-lg shadow-sm"
                          />
                        </div>
                      )}
                      {service.after_photo_url && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">After</p>
                          <img
                            src={service.after_photo_url}
                            alt="After service"
                            className="w-24 h-24 object-cover rounded-lg shadow-sm"
                          />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}