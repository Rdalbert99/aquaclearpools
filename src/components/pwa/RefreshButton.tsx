import { useCallback, useState, type ComponentProps } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { checkForUpdateNow } from "@/pwa/registerServiceWorker";
import { APP_VERSION } from "@/releaseNotes";

/**
 * Shared behaviour behind every "Refresh app" control: ask the server whether a
 * newer deployment was published, then either swap to it, tell the user they are
 * already current, or fall back to a plain reload where no service worker runs
 * (editor preview, plain browser tab).
 */
export function useRefreshApp() {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await checkForUpdateNow();

      switch (result) {
        case "updated":
          // The page is already reloading with the new version.
          toast({
            title: "Refreshing…",
            description: "Loading the new version of Aqua Clear.",
          });
          return;
        case "latest":
          toast({
            title: "You're on the latest version",
            description: `Aqua Clear v${APP_VERSION} is up to date.`,
          });
          break;
        case "offline":
          toast({
            title: "You're offline",
            description: "Reconnect, then tap Refresh app again.",
            variant: "destructive",
          });
          break;
        case "error":
          toast({
            title: "Couldn't check for updates",
            description: "Your connection may have dropped. Try again.",
            variant: "destructive",
          });
          break;
        default:
          // No service worker in this context — a plain reload is the refresh.
          toast({
            title: "Refreshing…",
            description: "Reloading Aqua Clear.",
          });
          window.location.reload();
          return;
      }
    } catch {
      toast({
        title: "Couldn't refresh right now",
        description: "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }, [busy, toast]);

  return { refresh, busy };
}

type RefreshButtonProps = ComponentProps<typeof Button> & { showLabel?: boolean };

/** A ready-made "Refresh app" button; use `useRefreshApp` for menu rows. */
export const RefreshButton = ({ showLabel = false, children, ...props }: RefreshButtonProps) => {
  const { refresh, busy } = useRefreshApp();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => void refresh()}
      disabled={busy}
      aria-label="Refresh app"
      title="Check for a new version of Aqua Clear"
      {...props}
    >
      <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
      {showLabel ? <span className="ml-2">{busy ? "Refreshing…" : "Refresh app"}</span> : null}
      {children}
    </Button>
  );
};
