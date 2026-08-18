import { Phone, MessageSquare, CalendarPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface StickyCTABarProps {
  onRequestService: () => void;
  className?: string;
}

const PHONE = '601-447-0399';

/**
 * Always-visible contact bar.
 * Mobile: full-width sticky bar pinned to the bottom of the viewport.
 * Desktop: compact floating card in the lower-right corner.
 */
export const StickyCTABar = ({ onRequestService, className }: StickyCTABarProps) => {
  return (
    <>
      {/* Mobile sticky bar */}
      <div
        className={cn(
          'md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-[env(safe-area-inset-bottom)] shadow-lg',
          className
        )}
      >
        <div className="grid grid-cols-3 gap-2 p-2">
          <Button asChild variant="outline" size="sm" className="h-11 flex-col gap-0.5 text-[11px]">
            <a href={`tel:${PHONE}`} aria-label={`Call Aqua Clear Pools at ${PHONE}`}>
              <Phone className="h-4 w-4" />
              Call
            </a>
          </Button>
          <Button asChild variant="outline" size="sm" className="h-11 flex-col gap-0.5 text-[11px]">
            <a href={`sms:${PHONE}`} aria-label={`Text Aqua Clear Pools at ${PHONE}`}>
              <MessageSquare className="h-4 w-4" />
              Text
            </a>
          </Button>
          <Button size="sm" className="h-11 flex-col gap-0.5 text-[11px]" onClick={onRequestService}>
            <CalendarPlus className="h-4 w-4" />
            Request
          </Button>
        </div>
      </div>

      {/* Desktop floating actions */}
      <div className="hidden md:flex fixed bottom-6 right-6 z-40 flex-col items-end gap-2">
        <div className="flex gap-2">
          <Button asChild variant="secondary" size="sm" className="shadow-md">
            <a href={`tel:${PHONE}`}>
              <Phone className="h-4 w-4 mr-2" />
              {PHONE}
            </a>
          </Button>
          <Button asChild variant="secondary" size="sm" className="shadow-md">
            <a href={`sms:${PHONE}`}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Text us
            </a>
          </Button>
        </div>
        <Button size="lg" className="shadow-xl" onClick={onRequestService}>
          <CalendarPlus className="h-5 w-5 mr-2" />
          Get a Free Pool Assessment
        </Button>
      </div>
    </>
  );
};
