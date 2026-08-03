import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const { t } = useTranslation();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      return;
    }

    // Check if user dismissed the prompt before
    const dismissed = localStorage.getItem("pwa-install-dismissed");
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) {
        return; // Don't show again for 7 days
      }
    }

    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    if (iOS) {
      // Show iOS-specific instructions after a delay
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }

    // Handle Android/Desktop PWA install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem("pwa-install-dismissed", Date.now().toString());
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 animate-slide-in-bottom">
      <div className="glass rounded-lg p-4 shadow-lg border border-gold-400/20">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-10 h-10 rounded-lg bg-gold-400/10 flex items-center justify-center">
            <Download size={20} className="text-gold-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-text-primary mb-1">
              {t("install.title")}
            </h3>
            {isIOS ? (
              <p className="text-xs text-text-secondary leading-relaxed">
                {t("install.iosInstructions")}
              </p>
            ) : (
              <p className="text-xs text-text-secondary mb-3">
                {t("install.description")}
              </p>
            )}
            {!isIOS && (
              <button
                onClick={handleInstall}
                className="w-full py-2 px-3 rounded-md bg-gold-400/15 hover:bg-gold-400/25 text-gold-400 text-xs font-medium transition-colors"
              >
                {t("install.install")}
              </button>
            )}
          </div>
          <button
            onClick={handleDismiss}
            className="shrink-0 p-1 rounded text-text-muted hover:text-text-primary transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
