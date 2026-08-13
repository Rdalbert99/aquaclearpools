import { analyzeSms } from '@/lib/sms-segments';
import { Badge } from '@/components/ui/badge';
import { MessageSquare } from 'lucide-react';

interface SmsPreviewProps {
  message: string;
  /** Where the message will be delivered, e.g. a phone number or email. */
  target?: string | null;
  /** Show the full message body, not just the counters. */
  showBody?: boolean;
  maxSegments?: number;
}

export function SmsPreview({ message, target, showBody = true, maxSegments = 10 }: SmsPreviewProps) {
  const info = analyzeSms(message, maxSegments);
  const nearLimit = !info.overLimit && info.segments >= maxSegments - 2;

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <MessageSquare className="h-4 w-4" /> Text preview
        </div>
        <Badge variant={info.overLimit ? 'destructive' : nearLimit ? 'secondary' : 'outline'}>
          {info.segments} / {maxSegments} segment{info.segments === 1 ? '' : 's'}
        </Badge>
      </div>

      {showBody && (
        <p className="text-sm whitespace-pre-wrap font-mono leading-snug">
          {message || <span className="text-muted-foreground">Nothing to send yet.</span>}
        </p>
      )}

      <div className="text-xs text-muted-foreground">
        {info.characters} characters · {info.encoding} · {info.remaining} left in this segment
        {target ? ` · Sends to ${target}` : ' · No phone or email on file'}
      </div>

      {info.overLimit && (
        <div className="text-xs text-destructive">
          Too long for Telnyx (max {maxSegments} parts). Shorten the message before sending.
        </div>
      )}
      {nearLimit && (
        <div className="text-xs text-amber-600">Close to the carrier limit — consider trimming.</div>
      )}
    </div>
  );
}
