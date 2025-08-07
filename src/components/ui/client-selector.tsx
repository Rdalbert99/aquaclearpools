import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { LoadingSpinner } from './loading-spinner';

interface Client {
  id: string;
  customer: string;
  pool_size: number;
  pool_type: string;
}

interface ClientSelectorProps {
  onClientSelect: (clientId: string) => void;
  selectedClientId?: string;
  placeholder?: string;
}

export function ClientSelector({ 
  onClientSelect, 
  selectedClientId, 
  placeholder = "Select a client..." 
}: ClientSelectorProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, customer, pool_size, pool_type')
        .order('customer');

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center space-x-2">
        <LoadingSpinner />
        <span className="text-sm text-muted-foreground">Loading clients...</span>
      </div>
    );
  }

  return (
    <Select value={selectedClientId} onValueChange={onClientSelect}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {clients.map((client) => (
          <SelectItem key={client.id} value={client.id}>
            <div className="flex flex-col">
              <span className="font-medium">{client.customer}</span>
              <span className="text-xs text-muted-foreground">
                {client.pool_size?.toLocaleString()} gal • {client.pool_type}
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}