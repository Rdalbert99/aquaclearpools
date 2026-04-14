import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Check, RefreshCw, Phone, User, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface InboundMessage {
  id: string;
  from_number: string;
  message_text: string;
  client_id: string | null;
  client_name: string | null;
  technician_id: string | null;
  technician_name: string | null;
  forwarded_to_tech: boolean;
  read_at: string | null;
  created_at: string;
}

export default function InboundMessages() {
  const [messages, setMessages] = useState<InboundMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('unread');

  const loadMessages = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('inbound_sms_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (filter === 'unread') {
        query = query.is('read_at', null);
      }

      const { data, error } = await query;
      if (error) throw error;
      setMessages((data as InboundMessage[]) || []);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, [filter]);

  const markAsRead = async (id: string) => {
    const { error } = await supabase
      .from('inbound_sms_messages')
      .update({ read_at: new Date().toISOString() } as any)
      .eq('id', id);

    if (error) {
      toast.error('Failed to mark as read');
    } else {
      setMessages(prev => prev.map(m => m.id === id ? { ...m, read_at: new Date().toISOString() } : m));
    }
  };

  const markAllRead = async () => {
    const unreadIds = messages.filter(m => !m.read_at).map(m => m.id);
    if (!unreadIds.length) return;

    const { error } = await supabase
      .from('inbound_sms_messages')
      .update({ read_at: new Date().toISOString() } as any)
      .in('id', unreadIds);

    if (error) {
      toast.error('Failed to mark all as read');
    } else {
      toast.success('All messages marked as read');
      loadMessages();
    }
  };

  const unreadCount = messages.filter(m => !m.read_at).length;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <MessageSquare className="h-7 w-7" />
            Inbound Messages
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">{unreadCount} new</Badge>
            )}
          </h1>
          <p className="text-muted-foreground text-sm">Customer SMS replies</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadMessages}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => setFilter(f => f === 'all' ? 'unread' : 'all')}>
            {filter === 'unread' ? 'Show All' : 'Unread Only'}
          </Button>
          {unreadCount > 0 && (
            <Button size="sm" onClick={markAllRead}>
              <Check className="h-4 w-4 mr-1" /> Mark All Read
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : messages.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>{filter === 'unread' ? 'No unread messages' : 'No messages yet'}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => (
            <Card key={msg.id} className={`transition-colors ${!msg.read_at ? 'border-primary/50 bg-primary/5' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="flex items-center gap-1 font-medium">
                        <Phone className="h-3.5 w-3.5" />
                        {msg.from_number}
                      </span>
                      {msg.client_name && (
                        <>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span className="flex items-center gap-1">
                            <User className="h-3.5 w-3.5" />
                            {msg.client_name}
                          </span>
                        </>
                      )}
                      <span className="text-muted-foreground text-xs">
                        {format(new Date(msg.created_at), 'MMM d, yyyy h:mm a')}
                      </span>
                    </div>

                    <p className="text-sm whitespace-pre-wrap">{msg.message_text}</p>

                    <div className="flex flex-wrap gap-2">
                      {msg.forwarded_to_tech && msg.technician_name && (
                        <Badge variant="secondary" className="text-xs">
                          Forwarded to {msg.technician_name}
                        </Badge>
                      )}
                      {!msg.client_name && (
                        <Badge variant="outline" className="text-xs text-warning">Unknown sender</Badge>
                      )}
                      {msg.read_at && (
                        <Badge variant="outline" className="text-xs text-primary">Read</Badge>
                      )}
                    </div>
                  </div>

                  {!msg.read_at && (
                    <Button variant="ghost" size="sm" onClick={() => markAsRead(msg.id)}>
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
