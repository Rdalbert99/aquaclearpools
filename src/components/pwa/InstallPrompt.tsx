import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Download, Share, X, RefreshCw, Smartphone, Trash2, Globe, Plus, HelpCircle } from 'lucide-react';
import { APP_VERSION } from '@/releaseNotes';

const DISMISS_KEY = 'acp_install_dismissed';
const REFRESH_VERSION_KEY = (v: string) => `acp_install_refresh_seen_v${v}`;

const SITE_URL = 'https://getaquaclear.com';

export const InstallPrompt = () => {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'install' | 'refresh'>('install');
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other');

  useEffect(() => {
    const standalone = isStandalone();
    const ua = navigator.userAgent;
    const detectedPlatform = /iphone|ipad|ipod/i.test(ua)
      ? 'ios'
      : /android/i.test(ua)
      ? 'android'
      : 'other';
    setPlatform(detectedPlatform);

    if (standalone) {
      // Already installed: show refresh hint once per published version.
      const seen = getStorage(REFRESH_VERSION_KEY(APP_VERSION)) === '1';
      if (!seen) setShowBanner(true);
      setActiveTab('refresh');
      return;
    }

    // Not installed: show install hint if not previously dismissed.
    if (getStorage(DISMISS_KEY) === '1') return;
    setShowBanner(true);
    setActiveTab('install');

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const dismissBanner = () => {
    setShowBanner(false);
  };

  const neverAskAgain = () => {
    setStorage(DISMISS_KEY, '1');
    dismissBanner();
  };

  const dismissRefresh = () => {
    setStorage(REFRESH_VERSION_KEY(APP_VERSION), '1');
    dismissBanner();
  };

  const runInstall = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    dismissBanner();
    setStorage(DISMISS_KEY, '1');
  };

  const isInstalled = isStandalone();

  if (!showBanner) return null;

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-[190] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-md items-center gap-3 rounded-lg border bg-card p-3 shadow-lg">
          {isInstalled ? (
            <>
              <RefreshCw className="h-5 w-5 shrink-0 text-primary" />
              <p className="flex-1 text-sm text-foreground">
                App icon updated? Reinstall to refresh it.
              </p>
              <Button size="sm" variant="secondary" onClick={() => setDialogOpen(true)}>
                How to
              </Button>
            </>
          ) : installEvent ? (
            <>
              <Download className="h-5 w-5 shrink-0 text-primary" />
              <p className="flex-1 text-sm text-foreground">Install Aqua Clear on this device</p>
              <Button size="sm" onClick={runInstall}>
                Install
              </Button>
            </>
          ) : (
            <>
              <Smartphone className="h-5 w-5 shrink-0 text-primary" />
              <p className="flex-1 text-sm text-foreground">
                Add Aqua Clear to your home screen for quick access.
              </p>
              <Button size="sm" variant="secondary" onClick={() => setDialogOpen(true)}>
                How to
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={isInstalled ? dismissRefresh : neverAskAgain}
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              {isInstalled ? 'Refresh your home screen icon' : 'Install Aqua Clear'}
            </DialogTitle>
            <DialogDescription>
              {isInstalled
                ? `iOS and Android cache the app icon when it is first installed. If the icon still looks old after our update, reinstall the app to refresh it.`
                : 'Add Aqua Clear to your home screen so it opens full-screen, like a native app.'}
            </DialogDescription>
          </DialogHeader>

          {!isInstalled && (
            <div className="flex rounded-md border p-1 bg-muted/50 mb-4">
              <button
                className={`flex-1 text-sm font-medium rounded px-3 py-1.5 transition-colors ${
                  activeTab === 'install' ? 'bg-background shadow-sm' : 'text-muted-foreground'
                }`}
                onClick={() => setActiveTab('install')}
              >
                Install
              </button>
              <button
                className={`flex-1 text-sm font-medium rounded px-3 py-1.5 transition-colors ${
                  activeTab === 'refresh' ? 'bg-background shadow-sm' : 'text-muted-foreground'
                }`}
                onClick={() => setActiveTab('refresh')}
              >
                Refresh icon
              </button>
            </div>
          )}

          {activeTab === 'install' && !isInstalled && (
            <div className="space-y-4">
              {platform === 'ios' && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    iOS Safari uses the Share menu to add apps to the home screen.
                  </p>
                  <InstructionStep
                    icon={<Share className="h-4 w-4" />}
                    number={1}
                    text="Open this site in Safari and tap the Share button at the bottom (or top) of the screen."
                  />
                  <InstructionStep
                    icon={<Plus className="h-4 w-4" />}
                    number={2}
                    text="Scroll down and tap Add to Home Screen."
                  />
                  <InstructionStep
                    icon={<Smartphone className="h-4 w-4" />}
                    number={3}
                    text="Tap Add in the top right, then open Aqua Clear from your home screen."
                  />
                </div>
              )}

              {platform === 'android' && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Android Chrome can install Aqua Clear directly.
                  </p>
                  <InstructionStep
                    icon={<Download className="h-4 w-4" />}
                    number={1}
                    text={
                      installEvent
                        ? 'Tap the Install button above to add the app to your home screen.'
                        : 'Tap the Chrome menu (three dots), then tap Add to Home Screen or Install app.'
                    }
                  />
                  <InstructionStep
                    icon={<Plus className="h-4 w-4" />}
                    number={2}
                    text="Confirm the install prompt."
                  />
                  <InstructionStep
                    icon={<Smartphone className="h-4 w-4" />}
                    number={3}
                    text="Open Aqua Clear from your home screen or app drawer."
                  />
                  {installEvent && (
                    <Button className="w-full" onClick={runInstall}>
                      <Download className="mr-2 h-4 w-4" />
                      Install Aqua Clear
                    </Button>
                  )}
                </div>
              )}

              {platform === 'other' && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    On most phones and tablets, use the browser menu to add this site to your home screen.
                  </p>
                  <InstructionStep
                    icon={<Globe className="h-4 w-4" />}
                    number={1}
                    text="Open the browser menu (three dots or share icon)."
                  />
                  <InstructionStep
                    icon={<Plus className="h-4 w-4" />}
                    number={2}
                    text="Choose Install, Add to Home Screen, or Add to Apps."
                  />
                  <InstructionStep
                    icon={<Smartphone className="h-4 w-4" />}
                    number={3}
                    text="Open Aqua Clear from your home screen or app list."
                  />
                </div>
              )}
            </div>
          )}

          {(activeTab === 'refresh' || isInstalled) && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                If your Aqua Clear icon still looks old, the app needs to be reinstalled. Your data is stored safely online, so reinstalling will not lose anything.
              </p>

              <div className="rounded-lg border p-3">
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Share className="h-4 w-4 text-primary" />
                  iPhone / iPad
                </h4>
                <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                  <li>On your home screen, press and hold the Aqua Clear icon.</li>
                  <li>Tap <strong>Remove App</strong>, then tap <strong>Delete App</strong>.</li>
                  <li>Open Safari and go to <strong>{SITE_URL}</strong>.</li>
                  <li>Tap the <strong>Share</strong> button, then <strong>Add to Home Screen</strong>.</li>
                  <li>Tap <strong>Add</strong> — the new icon will now appear.</li>
                </ol>
              </div>

              <div className="rounded-lg border p-3">
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Trash2 className="h-4 w-4 text-primary" />
                  Android
                </h4>
                <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                  <li>On your home screen or app drawer, press and hold the Aqua Clear icon.</li>
                  <li>Tap <strong>Remove</strong> or <strong>Uninstall</strong>.</li>
                  <li>Open Chrome and go to <strong>{SITE_URL}</strong>.</li>
                  <li>Tap the Chrome menu (three dots) → <strong>Add to Home Screen</strong> or accept the install banner.</li>
                  <li>Tap <strong>Install</strong> — the new icon will now appear.</li>
                </ol>
              </div>

              <div className="rounded-lg bg-muted p-3 flex gap-3">
                <HelpCircle className="h-5 w-5 shrink-0 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Still seeing the old icon? Try restarting your phone after reinstalling. Some devices keep the old icon in memory until rebooted.
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                if (isInstalled) dismissRefresh();
              }}
            >
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

function InstructionStep({
  icon,
  number,
  text,
}: {
  icon: React.ReactNode;
  number: number;
  text: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon}
      </div>
      <p className="text-sm text-foreground pt-0.5">
          <span className="font-semibold">Step {number}.</span> {text}
        </p>
    </div>
  );
}

function getStorage(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};
