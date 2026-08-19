import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { sendClientMessage, summarizeResults, type SendChannel } from '@/lib/client-message';
import { MessageSquare, Mail, CheckCircle, Send, UserPlus, Phone, Clock } from 'lucide-react';


interface ArrivalNotificationProps {
  clientName: string;
  clientId: string;
  clientPhone?: string | null;
  clientEmail?: string | null;
}

function greeting(d: Date = new Date()) {
  const h = d.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export type EtaConfidence = 'high' | 'medium' | 'low';

export const ETA_CONFIDENCE_OPTIONS: { value: EtaConfidence; label: string; phrase: string }[] = [
  { value: 'high', label: 'High - on schedule', phrase: 'We are on schedule.' },
  { value: 'medium', label: 'Medium - give or take 30 min', phrase: 'This could shift by about 30 minutes.' },
  { value: 'low', label: 'Low - rough estimate', phrase: 'This is a rough estimate and may change.' },
];

export function formatEtaClock(minutesFromNow: number, now: Date = new Date()) {
  const t = new Date(now.getTime() + minutesFromNow * 60_000);
  return t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function buildArrivalMessage(
  techName?: string | null,
  eta?: { minutes: number; confidence: EtaConfidence } | null,
) {
  const who = techName?.trim() ? `your technician ${techName.trim()}` : 'your technician';
  let msg = `${greeting()}, this is Aqua Clear Pools - ${who} is on the way to your pool for your service call.`;
  if (eta && eta.minutes > 0) {
    const phrase = ETA_CONFIDENCE_OPTIONS.find((o) => o.value === eta.confidence)?.phrase ?? '';
    msg += ` Estimated arrival: about ${eta.minutes} minutes (around ${formatEtaClock(eta.minutes)}). ${phrase}`;
  }
  return msg.trim();
}

export function ArrivalNotification({ clientName, clientId, clientPhone, clientEmail }: ArrivalNotificationProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const techName = (user as any)?.name || '';

  const [etaMinutes, setEtaMinutes] = useState<number>(15);
  const [etaConfidence, setEtaConfidence] = useState<EtaConfidence>('high');
  const arrivalMessage = buildArrivalMessage(techName, { minutes: etaMinutes, confidence: etaConfidence });

  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [savingContact, setSavingContact] = useState(false);

  // Use local overrides if the tech added contact info
  const [activePhone, setActivePhone] = useState(clientPhone || '');
  const [activeEmail, setActiveEmail] = useState(clientEmail || '');

  // Review dialog state
  const [reviewOpen, setReviewOpen] = useState(false);
  const [useSms, setUseSms] = useState(true);
  const [useEmail, setUseEmail] = useState(false);
  const [reviewMessage, setReviewMessage] = useState(arrivalMessage);

  function openReview() {
    setUseSms(!!activePhone);
    setUseEmail(!activePhone && !!activeEmail);
    setReviewMessage(buildArrivalMessage(techName, { minutes: etaMinutes, confidence: etaConfidence }));
    setReviewOpen(true);
  }


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

  async function handleSend() {
    const channels: SendChannel[] = [];
    if (useSms && activePhone) channels.push('sms');
    if (useEmail && activeEmail) channels.push('email');
    if (!channels.length) {
      toast({ title: 'Pick a delivery method', variant: 'destructive' });
      return;
    }
    const message = reviewMessage.trim() || arrivalMessage;
    setSending(true);
    try {
      const results = await sendClientMessage({
        channels,
        phone: activePhone,
        email: activeEmail,
        message,
        subject: 'Aqua Clear Pools - Your technician is on the way',
        log: {
          clientId,
          clientName,
          technicianId: (user as any)?.id ?? null,
          technicianName: techName || 'Unknown Tech',
          source: 'arrival_notification',
        },
      });
      const summary = summarizeResults(results);
      if (summary.sent.length) {
        setSent(true);
        setReviewOpen(false);
      }
      toast({
        title: summary.allSent ? 'Arrival notification sent' : summary.sent.length ? 'Partially sent' : 'Send failed',
        description: summary.text || 'No delivery method available.',
        variant: summary.failed.length ? 'destructive' : 'default',
      });
    } finally {
      setSending(false);
    }
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
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs flex items-center gap-1"><Clock className="h-3 w-3" /> Estimated arrival</Label>
            <Select value={String(etaMinutes)} onValueChange={(v) => setEtaMinutes(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="z-[100] bg-popover">
                {[5, 10, 15, 20, 30, 45, 60, 90, 120].map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {m} min (~{formatEtaClock(m)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">ETA confidence</Label>
            <Select value={etaConfidence} onValueChange={(v) => setEtaConfidence(v as EtaConfidence)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="z-[100] bg-popover">
                {ETA_CONFIDENCE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <p className="text-sm text-muted-foreground italic">
          "{arrivalMessage}"
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
          {hasContact && (
            <Button onClick={openReview} disabled={sending} variant="default" size="sm">
              <Send className="h-4 w-4 mr-2" />
              Review & Send
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

      <Dialog open={reviewOpen} onOpenChange={(o) => !sending && setReviewOpen(o)}>
        <DialogContent className="max-w-lg w-[calc(100vw-1.5rem)] max-h-[90dvh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Review Message</DialogTitle>
            <DialogDescription>
              Edit the message and choose how to deliver it to {clientName}.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={useSms}
                disabled={!activePhone}
                onCheckedChange={(c) => setUseSms(!!c)}
              />
              <MessageSquare className="h-4 w-4" />
              Text {activePhone ? `(${activePhone})` : '(no phone on file)'}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={useEmail}
                disabled={!activeEmail}
                onCheckedChange={(c) => setUseEmail(!!c)}
              />
              <Mail className="h-4 w-4" />
              Email {activeEmail ? `(${activeEmail})` : '(no email on file)'}
            </label>
          </div>

          <Textarea
            rows={6}
            value={reviewMessage}
            onChange={(e) => setReviewMessage(e.target.value)}
            className="font-mono text-sm"
          />
          <div className="text-xs text-muted-foreground">{reviewMessage.length} characters</div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setReviewOpen(false)} disabled={sending}>Cancel</Button>
            <Button
              variant="ghost"
              onClick={() => setReviewMessage(buildArrivalMessage(techName, { minutes: etaMinutes, confidence: etaConfidence }))}
              disabled={sending}
            >
              Reset
            </Button>
            <Button onClick={handleSend} disabled={sending || !reviewMessage.trim() || (!useSms && !useEmail)}>
              <Send className="h-4 w-4 mr-2" />
              {sending ? 'Sending…' : 'Send'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
