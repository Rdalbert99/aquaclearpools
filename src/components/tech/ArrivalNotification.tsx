import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Mail, CheckCircle, Send, UserPlus, Phone } from 'lucide-react';

interface ArrivalNotificationProps {
  clientName: string;
  clientId: string;
  clientPhone?: string | null;
  clientEmail?: string | null;
}

const ARRIVAL_MESSAGE = "This is Aqua Clear Pools, a technician is on his way to your pool for your weekly service.";

export function ArrivalNotification({ clientName, clientId, clientPhone, clientEmail }: ArrivalNotificationProps) {
  const { toast } = useToast();
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [savingContact, setSavingContact] = useState(false);

  // Use local overrides if the tech added contact info
  const [activePhone, setActivePhone] = useState(clientPhone || '');
  const [activeEmail, setActiveEmail] = useState(clientEmail || '');

  async function saveContact() {
    if (!newPhone && !newEmail) {
      toast({ title: 'Enter a phone or email', variant: 'destructive' });
      return;
    }
    setSavingContact(true);
    try {
      const updates: Record<string, string> = {};
      if (newPhone) updates.contact_phone = newPhone;
      if (newEmail) updates.contact_email = newEmail;

      const { error } = await supabase
        .from('clients')
        .update(updates)
        .eq('id', clientId);

      if (error) throw error;

      if (newPhone) setActivePhone(newPhone);
      if (newEmail) setActiveEmail(newEmail);
      setShowAddContact(false);
      toast({ title: 'Contact info saved', description: 'Updated client record.' });
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Error', description: e.message || 'Could not save contact info', variant: 'destructive' });
    } finally {
      setSavingContact(false);
    }
  }

  async function sendViaSMS() {
    const phone = activePhone;
    if (!phone) return;
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-sms-via-telnyx', {
        body: { to: phone, message: ARRIVAL_MESSAGE },
      });
      if (error) {
        console.error('SMS error, falling back to native:', error);
        window.location.href = `sms:${phone}?&body=${encodeURIComponent(ARRIVAL_MESSAGE)}`;
      }
      setSent(true);
      toast({ title: 'Arrival notification sent', description: `SMS sent to ${clientName}.` });
    } catch {
      window.location.href = `sms:${phone}?&body=${encodeURIComponent(ARRIVAL_MESSAGE)}`;
      setSent(true);
      toast({ title: 'SMS app opened', description: 'Send the message from your messaging app.' });
    } finally {
      setSending(false);
    }
  }

  function sendViaEmail() {
    const email = activeEmail;
    if (!email) return;
    window.location.href = `mailto:${email}?subject=${encodeURIComponent('Aqua Clear Pools - Service Visit')}&body=${encodeURIComponent(ARRIVAL_MESSAGE)}`;
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

  const hasContact = !!activePhone || !!activeEmail;

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
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground italic">
          "{ARRIVAL_MESSAGE}"
        </p>

        {/* Add contact info section */}
        {!hasContact && !showAddContact && (
          <div className="flex items-center gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <UserPlus className="h-4 w-4 text-amber-600 shrink-0" />
            <span className="text-sm text-amber-700 dark:text-amber-400">No contact info on file.</span>
            <Button size="sm" variant="outline" onClick={() => setShowAddContact(true)} className="ml-auto">
              Add Contact
            </Button>
          </div>
        )}

        {showAddContact && (
          <div className="space-y-3 p-3 rounded-md border bg-background">
            <div>
              <Label htmlFor="add-phone" className="text-xs">Phone Number</Label>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="add-phone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={newPhone}
                  onChange={e => setNewPhone(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="add-email" className="text-xs">Email</Label>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="add-email"
                  type="email"
                  placeholder="customer@email.com"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={saveContact} disabled={savingContact}>
                {savingContact ? 'Saving…' : 'Save & Continue'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAddContact(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Send buttons */}
        <div className="flex flex-wrap gap-3">
          {activePhone && (
            <Button onClick={sendViaSMS} disabled={sending} variant="default" size="sm">
              <MessageSquare className="h-4 w-4 mr-2" />
              {sending ? 'Sending…' : 'Send Text'}
            </Button>
          )}
          {activeEmail && (
            <Button onClick={sendViaEmail} variant="outline" size="sm">
              <Mail className="h-4 w-4 mr-2" />
              Send Email
            </Button>
          )}
          {hasContact && (
            <Button size="sm" variant="ghost" className="text-xs" onClick={() => setShowAddContact(!showAddContact)}>
              <UserPlus className="h-3 w-3 mr-1" /> {showAddContact ? 'Hide' : 'Update Contact'}
            </Button>
          )}
          <Button onClick={() => setSent(true)} variant="ghost" size="sm">
            Skip
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
