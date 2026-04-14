import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, Check, RefreshCw, Phone, User, ArrowRight, Droplets, Wrench } from 'lucide-react';
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

interface PoolNeedsMessage {
  id: string;
  client_id: string | null;
  client_name: string;
  technician_id: string | null;
  technician_name: string;
  pool_size: number | null;
  pool_type: string | null;
  chemical_needs: any[];
  test_results: any;
  read_at: string | null;
  created_at: string;
}

export default function InboundMessages() {
  const [messages, setMessages] = useState<InboundMessage[]>([]);
  const [poolNeeds, setPoolNeeds] = useState<PoolNeedsMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [poolNeedsLoading, setPoolNeedsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('unread');
  const [poolNeedsFilter, setPoolNeedsFilter] = useState<'all' | 'unread'>('unread');
  const [activeTab, setActiveTab] = useState('text-messages');

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

  const loadPoolNeeds = async () => {
    setPoolNeedsLoading(true);
    try {
      let query = supabase
        .from('pool_needs_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (poolNeedsFilter === 'unread') {
        query = query.is('read_at', null);
      }

      const { data, error } = await query;
      if (error) throw error;
      setPoolNeeds((data as PoolNeedsMessage[]) || []);
    } catch (error) {
      console.error('Error loading pool needs:', error);
      toast.error('Failed to load pool needs');
    } finally {
      setPoolNeedsLoading(false);
    }
  };

  useEffect(() => { loadMessages(); }, [filter]);
  useEffect(() => { loadPoolNeeds(); }, [poolNeedsFilter]);

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

  const markPoolNeedAsRead = async (id: string) => {
    const { error } = await supabase
      .from('pool_needs_messages')
      .update({ read_at: new Date().toISOString() } as any)
      .eq('id', id);
    if (error) {
      toast.error('Failed to mark as read');
    } else {
      setPoolNeeds(prev => prev.map(m => m.id === id ? { ...m, read_at: new Date().toISOString() } : m));
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

  const markAllPoolNeedsRead = async () => {
    const unreadIds = poolNeeds.filter(m => !m.read_at).map(m => m.id);
    if (!unreadIds.length) return;
    const { error } = await supabase
      .from('pool_needs_messages')
      .update({ read_at: new Date().toISOString() } as any)
      .in('id', unreadIds);
    if (error) {
      toast.error('Failed to mark all as read');
    } else {
      toast.success('All pool needs marked as read');
      loadPoolNeeds();
    }
  };

  const smsUnread = messages.filter(m => !m.read_at).length;
  const poolNeedsUnread = poolNeeds.filter(m => !m.read_at).length;
  const totalUnread = smsUnread + poolNeedsUnread;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <MessageSquare className="h-7 w-7" />
            Messages
            {totalUnread > 0 && (
              <Badge variant="destructive" className="ml-2">{totalUnread} new</Badge>
            )}
          </h1>
          <p className="text-muted-foreground text-sm">Customer SMS replies &amp; tech pool needs</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="text-messages" className="relative">
            <Phone className="h-4 w-4 mr-1.5" />
            Text Messages
            {smsUnread > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 min-w-[20px] px-1 text-[10px]">
                {smsUnread}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="pool-needs" className="relative">
            <Droplets className="h-4 w-4 mr-1.5" />
            Pool Needs
            {poolNeedsUnread > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 min-w-[20px] px-1 text-[10px]">
                {poolNeedsUnread}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* TEXT MESSAGES TAB */}
        <TabsContent value="text-messages" className="space-y-4 mt-4">
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={loadMessages}>
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => setFilter(f => f === 'all' ? 'unread' : 'all')}>
              {filter === 'unread' ? 'Show All' : 'Unread Only'}
            </Button>
            {smsUnread > 0 && (
              <Button size="sm" onClick={markAllRead}>
                <Check className="h-4 w-4 mr-1" /> Mark All Read
              </Button>
            )}
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
                              <span className="flex items-center gap-1 font-medium text-primary">
                                <User className="h-3.5 w-3.5" />
                                {msg.client_name}
                              </span>
                            </>
                          )}
                          {msg.technician_name && (
                            <>
                              <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Wrench className="h-3.5 w-3.5" />
                                Tech: {msg.technician_name}
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
                            <Badge variant="outline" className="text-xs text-orange-600">Unknown sender</Badge>
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
        </TabsContent>

        {/* POOL NEEDS TAB */}
        <TabsContent value="pool-needs" className="space-y-4 mt-4">
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={loadPoolNeeds}>
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPoolNeedsFilter(f => f === 'all' ? 'unread' : 'all')}>
              {poolNeedsFilter === 'unread' ? 'Show All' : 'Unread Only'}
            </Button>
            {poolNeedsUnread > 0 && (
              <Button size="sm" onClick={markAllPoolNeedsRead}>
                <Check className="h-4 w-4 mr-1" /> Mark All Read
              </Button>
            )}
          </div>

          {poolNeedsLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : poolNeeds.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Droplets className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>{poolNeedsFilter === 'unread' ? 'No unread pool needs' : 'No pool needs yet'}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {poolNeeds.map((pn) => (
                <Card key={pn.id} className={`transition-colors ${!pn.read_at ? 'border-primary/50 bg-primary/5' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="flex items-center gap-1 font-medium text-primary">
                            <User className="h-3.5 w-3.5" />
                            {pn.client_name}
                          </span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Wrench className="h-3.5 w-3.5" />
                            Tech: {pn.technician_name}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {format(new Date(pn.created_at), 'MMM d, yyyy h:mm a')}
                          </span>
                        </div>

                        {pn.pool_size && (
                          <p className="text-xs text-muted-foreground">
                            {pn.pool_type} • {pn.pool_size.toLocaleString()} gal
                          </p>
                        )}

                        {/* Test results */}
                        {pn.test_results && (
                          <div className="flex flex-wrap gap-2 text-xs">
                            {pn.test_results.ph != null && <Badge variant="outline">pH: {pn.test_results.ph}</Badge>}
                            {pn.test_results.fc != null && <Badge variant="outline">FC: {pn.test_results.fc}</Badge>}
                            {pn.test_results.ta != null && <Badge variant="outline">TA: {pn.test_results.ta}</Badge>}
                            {pn.test_results.cya != null && <Badge variant="outline">CYA: {pn.test_results.cya}</Badge>}
                            {pn.test_results.salt != null && <Badge variant="outline">Salt: {pn.test_results.salt}</Badge>}
                          </div>
                        )}

                        {/* Chemical needs */}
                        {Array.isArray(pn.chemical_needs) && pn.chemical_needs.length > 0 && (
                          <ul className="list-disc pl-4 text-sm space-y-0.5">
                            {pn.chemical_needs.map((need: string, i: number) => (
                              <li key={i}>{need}</li>
                            ))}
                          </ul>
                        )}

                        {pn.read_at && (
                          <Badge variant="outline" className="text-xs text-primary">Read</Badge>
                        )}
                      </div>

                      {!pn.read_at && (
                        <Button variant="ghost" size="sm" onClick={() => markPoolNeedAsRead(pn.id)}>
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
