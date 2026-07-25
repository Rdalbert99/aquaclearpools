import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { registerServiceWorker } from '@/pwa/registerServiceWorker';
import { APP_VERSION } from '@/releaseNotes';

const SEEN_VERSION_KEY = 'acp_seen_version';

/**
 * Mounts service worker registration and shows a small banner when a newer
 * deployment is available, plus a one-time "What's new" nudge after updating.
 */
export const UpdatePrompt = () => {
  const navigate = useNavigate();
  const [applyUpdate, setApplyUpdate] = useState<(() => void) | null>(null);
  const [reloading, setReloading] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);

  useEffect(() => {
    registerServiceWorker({
      onUpdateAvailable: (apply) => setApplyUpdate(() => apply),
    });
  }, []);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(SEEN_VERSION_KEY);
      if (seen && seen !== APP_VERSION) setShowWhatsNew(true);
      if (!seen) localStorage.setItem(SEEN_VERSION_KEY, APP_VERSION);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const dismissWhatsNew = () => {
    try {
      localStorage.setItem(SEEN_VERSION_KEY, APP_VERSION);
    } catch {
      /* storage unavailable */
    }
    setShowWhatsNew(false);
  };

  if (applyUpdate) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-[200] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-md items-center gap-3 rounded-lg border bg-card p-3 shadow-lg">
          <RefreshCw className={`h-5 w-5 shrink-0 text-primary ${reloading ? 'animate-spin' : ''}`} />
          <p className="flex-1 text-sm text-foreground">
            A new version of Aqua Clear is available.
          </p>
          <Button
            size="sm"
            disabled={reloading}
            onClick={() => {
              setReloading(true);
              applyUpdate();
            }}
          >
            {reloading ? 'Updating…' : 'Update now'}
          </Button>
        </div>
      </div>
    );
  }

  if (showWhatsNew) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-[200] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-md items-center gap-3 rounded-lg border bg-card p-3 shadow-lg">
          <p className="flex-1 text-sm text-foreground">
            Aqua Clear was updated to v{APP_VERSION}.
          </p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              dismissWhatsNew();
              navigate('/whats-new');
            }}
          >
            What's new
          </Button>
          <Button size="sm" variant="ghost" onClick={dismissWhatsNew}>
            Dismiss
          </Button>
        </div>
      </div>
    );
  }

  return null;
};
