import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { Building2, ExternalLink } from "lucide-react";

type ClientWithUser = {
  id: string;
  customer: string;
  qb_invoice_link?: string | null;
  qb_customer_id?: string | null;
  users?: {
    name?: string;
    email?: string;
  } | null;
};

export default function ManageClients() {
  const [clients, setClients] = useState<ClientWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchClients();
  }, []);

  async function fetchClients() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("clients")
        .select(`
          id,
          customer,
          qb_invoice_link,
          qb_customer_id,
          users!clients_user_id_fkey (
            name,
            email
          )
        `)
        .order("customer");
      
      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast({
        title: "Error",
        description: "Failed to load clients",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function updateClient(id: string, field: string, value: string) {
    try {
      const { error } = await supabase
        .from("clients")
        .update({ [field]: value || null })
        .eq("id", id);
      
      if (error) throw error;
      
      // Update local state
      setClients(prev => prev.map(client => 
        client.id === id ? { ...client, [field]: value } : client
      ));
      
      toast({
        title: "Success",
        description: "Client updated successfully",
      });
    } catch (error) {
      console.error('Error updating client:', error);
      toast({
        title: "Error", 
        description: "Failed to update client",
        variant: "destructive",
      });
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Building2 className="h-6 w-6" />
        <h1 className="text-3xl font-bold">Manage Clients</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>QuickBooks Integration</CardTitle>
          <CardDescription>
            Manage QuickBooks invoice links and customer IDs for each client
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">Client Name</th>
                  <th className="text-left p-3 font-medium">Contact Email</th>
                  <th className="text-left p-3 font-medium">QB Customer ID</th>
                  <th className="text-left p-3 font-medium">QB Invoice Link</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id} className="border-b hover:bg-muted/50">
                    <td className="p-3 font-medium">{client.customer}</td>
                    <td className="p-3 text-muted-foreground">
                      {client.users?.email || 'No email'}
                    </td>
                    <td className="p-3">
                      <Input
                        type="text"
                        defaultValue={client.qb_customer_id || ""}
                        className="max-w-[200px]"
                        onBlur={(e) =>
                          updateClient(client.id, "qb_customer_id", e.target.value)
                        }
                        placeholder="QB Customer ID"
                      />
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Input
                          type="url"
                          defaultValue={client.qb_invoice_link || ""}
                          className="min-w-[300px]"
                          onBlur={(e) =>
                            updateClient(client.id, "qb_invoice_link", e.target.value)
                          }
                          placeholder="https://quickbooks.intuit.com/pay/..."
                        />
                        {client.qb_invoice_link && (
                          <a
                            href={client.qb_invoice_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-shrink-0 p-2 hover:bg-muted rounded"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {clients.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No clients found
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}