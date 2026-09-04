import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle } from 'lucide-react';

export interface IssueFollowUpValue {
  date: string;
  description?: string;
  partsNeeded: boolean;
  orderedBy?: 'aqua_clear' | 'customer';
}

interface Props {
  open: boolean;
  saving?: boolean;
  equipmentLabel: string;
  initialDescription?: string;
  onSkip: () => void;
  onConfirm: (value: IssueFollowUpValue) => void;
}

function defaultDate(daysAhead = 7) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function IssueFollowUpPrompt({ open, saving, equipmentLabel, initialDescription, onSkip, onConfirm }: Props) {
  const [date, setDate] = useState(defaultDate());
  const [description, setDescription] = useState('');
  const [partsNeeded, setPartsNeeded] = useState<boolean | null>(null);
  const [orderedBy, setOrderedBy] = useState<'aqua_clear' | 'customer'>('aqua_clear');

  useEffect(() => {
    if (open) {
      setDate(defaultDate());
      setDescription(initialDescription ?? '');
      setPartsNeeded(null);
      setOrderedBy('aqua_clear');
    }
  }, [open, initialDescription]);

  const canConfirm = !!date && partsNeeded !== null && (!partsNeeded || !!orderedBy);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !saving) onSkip(); }}>
      <DialogContent className="max-w-md w-[calc(100vw-1.5rem)] p-4 sm:p-6 z-[100]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" /> {equipmentLabel} issue — schedule follow-up?
          </DialogTitle>
          <DialogDescription>
            This creates a follow-up visit on the Follow-Ups dashboard so the repair does not get missed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="issue-desc">What's wrong</Label>
            <Textarea id="issue-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder={`Describe the ${equipmentLabel.toLowerCase()} issue...`} />
          </div>

          <div>
            <Label>Are parts needed?</Label>
            <div className="mt-2 flex gap-2">
              <Button type="button" size="sm" variant={partsNeeded === true ? 'default' : 'outline'}
                onClick={() => setPartsNeeded(true)}>Yes, parts needed</Button>
              <Button type="button" size="sm" variant={partsNeeded === false ? 'default' : 'outline'}
                onClick={() => setPartsNeeded(false)}>No parts needed</Button>
            </div>
          </div>

          {partsNeeded && (
            <div>
              <Label htmlFor="issue-ordered-by">Who is ordering the parts?</Label>
              <Select value={orderedBy} onValueChange={(v) => setOrderedBy(v as 'aqua_clear' | 'customer')}>
                <SelectTrigger id="issue-ordered-by"><SelectValue /></SelectTrigger>
                <SelectContent className="z-[110]">
                  <SelectItem value="aqua_clear">Aqua Clear is ordering</SelectItem>
                  <SelectItem value="customer">Customer is ordering</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label htmlFor="issue-fu-date">Follow-up date</Label>
            <Input id="issue-fu-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <div className="mt-2 flex flex-wrap gap-2">
              {[2, 3, 7, 14].map(d => (
                <Button key={d} type="button" size="sm" variant="outline" onClick={() => setDate(defaultDate(d))}>
                  +{d}d
                </Button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 flex-col sm:flex-row">
          <Button variant="outline" className="w-full sm:w-auto" disabled={saving} onClick={onSkip}>
            Skip — no follow-up
          </Button>
          <Button
            className="w-full sm:w-auto"
            disabled={saving || !canConfirm}
            onClick={() => onConfirm({
              date,
              description: description.trim() || undefined,
              partsNeeded: partsNeeded === true,
              orderedBy: partsNeeded ? orderedBy : undefined,
            })}
          >
            Create follow-up
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
