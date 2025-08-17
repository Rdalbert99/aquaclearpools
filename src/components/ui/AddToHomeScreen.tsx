import { useEffect, useState } from "react";

export default function AddToHomeScreen() {
  const [deferred, setDeferred] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  const isiOS = () =>
    /iphone|ipad|ipod/i.test(window.navigator.userAgent) ||
    (navigator.userAgent.includes("Mac") && "ontouchend" in document);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferred(e);
      setShowPrompt(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (isiOS()) {
    // iOS Safari: no beforeinstallprompt; show instructions
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50">
        <div className="rounded-md border bg-white p-3 shadow">
          <div className="font-medium mb-1">Install Aqua Clear</div>
          <div className="text-sm text-gray-600">
            On iPhone: tap <span className="font-medium">Share</span> →{" "}
            <span className="font-medium">Add to Home Screen</span>.
          </div>
        </div>
      </div>
    );
  }

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50">
      <div className="rounded-md border bg-white p-3 shadow flex items-center justify-between gap-3">
        <div>
          <div className="font-medium">Install Aqua Clear</div>
          <div className="text-sm text-gray-600">Get full-screen, faster loads.</div>
        </div>
        <div className="flex gap-2">
          <button
            className="px-3 py-1 rounded border"
            onClick={() => setShowPrompt(false)}
          >
            Not now
          </button>
          <button
            className="px-3 py-1 rounded bg-blue-600 text-white"
            onClick={async () => {
              if (!deferred) return;
              deferred.prompt();
              const choice = await deferred.userChoice;
              // choice.outcome: "accepted" | "dismissed"
              setDeferred(null);
              setShowPrompt(false);
            }}
          >
            Install
          </button>
        </div>
      </div>
    </div>
  );
}