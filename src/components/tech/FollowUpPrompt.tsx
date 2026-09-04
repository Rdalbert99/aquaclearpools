import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarClock } from 'lucide-react';

export const FOLLOW_UP_REASONS = [
  'Recheck chemistry',
  'Algae treatment',
  'Equipment repair',
  'Equipment install',
  'Filter clean / backwash',
  'Salt cell service',
  'Customer request',
  'Other',
] as const;

export interface FollowUpValue {
  date: string;
  reason: string;
  notes?: string;
}

interface Props {
  open: boolean;
  saving?: boolean;
  onSkip: () => void;
  onConfirm: (value: FollowUpValue) => void;
}

function defaultDate(daysAhead = 7) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function FollowUpPrompt({ open, saving, onSkip, onConfirm }: Props) {
  const [date, setDate] = useState(defaultDate());
  const [reason, setReason] = useState<string>(FOLLOW_UP_REASONS[0]);
  const [notes, setNotes] = useState('');

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !saving) onSkip(); }}>
      <DialogContent className="max-w-md w-[calc(100vw-1.5rem)] p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" /> Schedule a follow-up?
          </DialogTitle>
          <DialogDescription>
            This creates the visit automatically and puts it on the Follow-Ups dashboard.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="fu-date">Follow-up date</Label>
            <Input id="fu-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <div className="mt-2 flex flex-wrap gap-2">
              {[2, 3, 7, 14].map(d => (
                <Button key={d} type="button" size="sm" variant="outline" onClick={() => setDate(defaultDate(d))}>
                  +{d}d
                </Button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="fu-reason">Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="fu-reason"><SelectValue /></SelectTrigger>
              <SelectContent className="z-[100]">
                {FOLLOW_UP_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="fu-notes">Notes for the next visit</Label>
            <Textarea id="fu-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="What needs doing and why..." />
          </div>
        </div>

        <DialogFooter className="gap-2 flex-col sm:flex-row">
          <Button variant="outline" className="w-full sm:w-auto" disabled={saving} onClick={onSkip}>
            No follow-up needed
          </Button>
          <Button
            className="w-full sm:w-auto"
            disabled={saving || !date || !reason}
            onClick={() => onConfirm({ date, reason, notes: notes.trim() || undefined })}
          >
            Create follow-up
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
