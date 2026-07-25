import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Share, X } from 'lucide-react';

const DISMISS_KEY = 'acp_install_dismissed';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  // iOS Safari
  (window.navigator as unknown as { standalone?: boolean }).standalone === true;

const isIos = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);

/** Small, dismissible "Install app" hint. Never blocks the UI. */
export const InstallPrompt = () => {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') return;
    } catch {
      /* storage unavailable */
    }

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    if (isIos()) setShowIosHint(true);

    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* storage unavailable */
    }
    setInstallEvent(null);
    setShowIosHint(false);
  };

  if (!installEvent && !showIosHint) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[190] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-md items-center gap-3 rounded-lg border bg-card p-3 shadow-lg">
        {installEvent ? (
          <>
            <Download className="h-5 w-5 shrink-0 text-primary" />
            <p className="flex-1 text-sm text-foreground">Install Aqua Clear on this device</p>
            <Button
              size="sm"
              onClick={async () => {
                await installEvent.prompt();
                dismiss();
              }}
            >
              Install
            </Button>
          </>
        ) : (
          <>
            <Share className="h-5 w-5 shrink-0 text-primary" />
            <p className="flex-1 text-sm text-foreground">
              Add Aqua Clear to your home screen: tap Share, then "Add to Home Screen".
            </p>
          </>
        )}
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={dismiss} aria-label="Dismiss">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
