import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Mail, CheckCircle, Send } from 'lucide-react';

interface ArrivalNotificationProps {
  clientName: string;
  clientPhone?: string | null;
  clientEmail?: string | null;
}

const ARRIVAL_MESSAGE = "This is Aqua Clear Pools, a technician is on his way to your pool for your weekly service.";

export function ArrivalNotification({ clientName, clientPhone, clientEmail }: ArrivalNotificationProps) {
  const { toast } = useToast();
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  async function sendViaSMS() {
    if (!clientPhone) return;
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-sms-via-telnyx', {
        body: { to: clientPhone, message: ARRIVAL_MESSAGE },
      });
      if (error) {
        console.error('SMS error, falling back to native:', error);
        window.location.href = `sms:${clientPhone}?&body=${encodeURIComponent(ARRIVAL_MESSAGE)}`;
      }
      setSent(true);
      toast({ title: 'Arrival notification sent', description: `SMS sent to ${clientName}.` });
    } catch {
      window.location.href = `sms:${clientPhone}?&body=${encodeURIComponent(ARRIVAL_MESSAGE)}`;
      setSent(true);
      toast({ title: 'SMS app opened', description: 'Send the message from your messaging app.' });
    } finally {
      setSending(false);
    }
  }

  function sendViaEmail() {
    if (!clientEmail) return;
    window.location.href = `mailto:${clientEmail}?subject=${encodeURIComponent('Aqua Clear Pools - Service Visit')}&body=${encodeURIComponent(ARRIVAL_MESSAGE)}`;
    setSent(true);
    toast({ title: 'Email app opened', description: 'Send the message from your email app.' });
  }

  if (sent) {
    return (
      <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30">
        <CardContent className="py-4 flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <span className="text-sm font-medium text-green-700 dark:text-green-400">
            Arrival notification sent to {clientName}
          </span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Send className="h-4 w-4" /> Notify Customer of Arrival
        </CardTitle>
        <CardDescription>
          Let {clientName} know you're on the way.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4 italic">
          "{ARRIVAL_MESSAGE}"
        </p>
        <div className="flex flex-wrap gap-3">
          {clientPhone && (
            <Button onClick={sendViaSMS} disabled={sending} variant="default" size="sm">
              <MessageSquare className="h-4 w-4 mr-2" />
              {sending ? 'Sending…' : 'Send Text'}
            </Button>
          )}
          {clientEmail && (
            <Button onClick={sendViaEmail} variant="outline" size="sm">
              <Mail className="h-4 w-4 mr-2" />
              Send Email
            </Button>
          )}
          {!clientPhone && !clientEmail && (
            <Badge variant="secondary">No contact info available</Badge>
          )}
          <Button onClick={() => setSent(true)} variant="ghost" size="sm">
            Skip
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
