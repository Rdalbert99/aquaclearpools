import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TEST_BY_ID, type TestId } from '@/lib/pool-tests';

interface TestGuideDialogProps {
  testId: TestId;
  /** Optional smaller trigger for dense layouts. */
  className?: string;
}

/** Help icon that opens a field-friendly Taylor test-kit guide for one test. */
export function TestGuideDialog({ testId, className }: TestGuideDialogProps) {
  const [open, setOpen] = useState(false);
  const test = TEST_BY_ID[testId];
  if (!test) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={`How to test ${test.label} with a Taylor kit`}
          className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-primary hover:bg-muted transition-colors ${className ?? ''}`}
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader className="text-left">
          <DialogTitle>{test.label} — Taylor kit steps</DialogTitle>
          <DialogDescription>{test.reagents}</DialogDescription>
        </DialogHeader>

        <ol className="list-decimal list-outside pl-5 space-y-2 text-sm">
          {test.steps.map((s, i) => <li key={i}>{s}</li>)}
        </ol>

        {test.tips.length > 0 && (
          <div className="rounded-md border bg-muted/40 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
              Avoid these mistakes
            </p>
            <ul className="list-disc pl-4 space-y-1 text-sm">
              {test.tips.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </div>
        )}

        <DialogFooter>
          <Button className="w-full sm:w-auto" onClick={() => setOpen(false)}>Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
