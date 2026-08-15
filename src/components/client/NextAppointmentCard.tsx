import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CalendarClock, CalendarX2, CheckCircle, MessageSquarePlus, RefreshCw } from 'lucide-react';

export type AppointmentStatus = 'scheduled' | 'completed' | 'canceled' | 'reschedule-requested' | 'none';

interface ServiceRequestRow {
  id: string;
  request_type: string;
  description: string;
  status: string;
  preferred_date: string | null;
  created_at: string;
}

interface NextAppointmentCardProps {
  clientId: string;
  nextServiceDate: string | null;
  technicianName?: string | null;
  lastServiceDate?: string | null;
  requests: ServiceRequestRow[];
  onChanged: () => void;
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function getAppointmentStatus(
  nextServiceDate: string | null,
  lastServiceDate: string | null | undefined,
  requests: ServiceRequestRow[]
): AppointmentStatus {
  if (!nextServiceDate) return 'none';
  const next = new Date(nextServiceDate);

  const cancelRequest = requests.find(
    (r) => r.request_type === 'cancellation' && ['pending', 'approved'].includes(r.status)
  );
  if (cancelRequest) return 'canceled';

  if (lastServiceDate) {
    const last = new Date(lastServiceDate);
    if (sameDay(last, next) || last > next) return 'completed';
  }

  const reschedule = requests.find((r) => r.request_type === 'reschedule' && r.status === 'pending');
  if (reschedule) return 'reschedule-requested';

  return 'scheduled';
}

const STATUS_META: Record<Exclude<AppointmentStatus, 'none'>, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  scheduled: { label: 'Scheduled', variant: 'default' },
  completed: { label: 'Completed', variant: 'secondary' },
  canceled: { label: 'Canceled', variant: 'destructive' },
  'reschedule-requested': { label: 'Reschedule requested', variant: 'outline' },
};

export function NextAppointmentCard({
  clientId,
  nextServiceDate,
  technicianName,
  lastServiceDate,
  requests,
  onChanged,
}: NextAppointmentCardProps) {
  const { toast } = useToast();
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [preferredDate, setPreferredDate] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const status = getAppointmentStatus(nextServiceDate, lastServiceDate, requests);
  const meta = status === 'none' ? null : STATUS_META[status];

  const openNotes = requests.filter(
    (r) => r.request_type === 'site_note' && ['pending', 'in-progress'].includes(r.status)
  );
  const openReschedules = requests.filter((r) => r.request_type === 'reschedule' && r.status === 'pending');

  const submitReschedule = async () => {
    if (!preferredDate) {
      toast({ title: 'Pick a date', description: 'Please choose a preferred new date.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('service_requests').insert({
        client_id: clientId,
        request_type: 'reschedule',
        description:
          `Reschedule requested${nextServiceDate ? ` (currently ${new Date(nextServiceDate).toLocaleDateString()})` : ''}. ` +
          `Preferred new date: ${new Date(preferredDate).toLocaleDateString()}.` +
          (reason.trim() ? ` Reason: ${reason.trim()}` : ''),
        preferred_date: new Date(preferredDate).toISOString(),
        status: 'pending',
        priority: 'medium',
      });
      if (error) throw error;
      toast({ title: 'Reschedule requested', description: 'We\'ll confirm your new appointment time shortly.' });
      setRescheduleOpen(false);
      setPreferredDate('');
      setReason('');
      onChanged();
    } catch (error: any) {
      toast({ title: 'Error', description: error?.message || 'Could not send your request.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const submitNote = async () => {
    if (!note.trim()) {
      toast({ title: 'Add a note', description: 'Please describe what you\'d like the tech to look at.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('service_requests').insert({
        client_id: clientId,
        request_type: 'site_note',
        description: note.trim(),
        status: 'pending',
        priority: 'low',
      });
      if (error) throw error;
      toast({ title: 'Note sent', description: 'Your technician will see this on their next visit.' });
      setNoteOpen(false);
      setNote('');
      onChanged();
    } catch (error: any) {
      toast({ title: 'Error', description: error?.message || 'Could not save your note.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-primary" />
          <span>Next Appointment</span>
        </CardTitle>
        <CardDescription>Your upcoming pool service and requests</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 rounded-lg bg-muted p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">
              {nextServiceDate
                ? new Date(nextServiceDate).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })
                : 'No appointment scheduled yet'}
            </p>
            <p className="text-sm text-muted-foreground">
              {technicianName ? `with ${technicianName}` : 'Technician to be assigned'}
            </p>
          </div>
          {meta && (
            <Badge variant={meta.variant} className="w-fit">
              {status === 'completed' && <CheckCircle className="mr-1 h-3 w-3" />}
              {status === 'canceled' && <CalendarX2 className="mr-1 h-3 w-3" />}
              {status === 'reschedule-requested' && <RefreshCw className="mr-1 h-3 w-3" />}
              {meta.label}
            </Badge>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="flex-1" onClick={() => setRescheduleOpen(true)}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Request reschedule
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => setNoteOpen(true)}>
            <MessageSquarePlus className="mr-2 h-4 w-4" />
            Note for your tech
          </Button>
        </div>

        {openReschedules.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Pending reschedule requests</p>
            {openReschedules.map((r) => (
              <div key={r.id} className="rounded-md border p-3 text-sm">
                <p>{r.description}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Sent {new Date(r.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}

        {openNotes.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Notes for your technician</p>
            {openNotes.map((n) => (
              <div key={n.id} className="rounded-md border p-3 text-sm">
                <p>{n.description}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Sent {new Date(n.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
        <DialogContent className="z-[100] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Request a reschedule</DialogTitle>
            <DialogDescription>
              Tell us when works better and we'll confirm the new appointment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="preferred-date">Preferred new date</Label>
              <Input
                id="preferred-date"
                type="date"
                value={preferredDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setPreferredDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reschedule-reason">Reason (optional)</Label>
              <Textarea
                id="reschedule-reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Out of town, pool party, gate access, etc."
              />
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setRescheduleOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submitReschedule} disabled={saving}>
              {saving ? 'Sending...' : 'Send request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent className="z-[100] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Note for your technician</DialogTitle>
            <DialogDescription>
              Anything to look at or fix while on site? Your tech will see this before the visit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="site-note">Note</Label>
            <Textarea
              id="site-note"
              rows={5}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Skimmer lid is cracked, please check the pump noise, gate code is 1234..."
            />
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setNoteOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submitNote} disabled={saving}>
              {saving ? 'Sending...' : 'Send note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
