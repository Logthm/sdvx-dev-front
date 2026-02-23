import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";

const LANGUAGES = [
  { code: "zh-CN", label: "简体中文", fontFamily: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif' },
  { code: "zh-TW", label: "繁體中文", fontFamily: '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif' },
  { code: "ja", label: "日本語", fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif' },
  { code: "en", label: "English", fontFamily: '"Inter", sans-serif' },
] as const;

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLanguage = LANGUAGES.find((lang) => lang.code === i18n.language) || LANGUAGES[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  function changeLanguage(langCode: string) {
    i18n.changeLanguage(langCode);
    setIsOpen(false);
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-cosmos-600/30 text-text-muted hover:text-text-primary hover:border-cosmos-600/60 transition-colors"
        title={currentLanguage.label}
      >
        <Languages size={16} />
        <span lang={currentLanguage.code} style={{ fontFamily: currentLanguage.fontFamily }} className="hidden sm:inline text-xs font-medium">{currentLanguage.label}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-40 bg-cosmos-900 border border-cosmos-600/30 rounded-lg shadow-xl overflow-hidden z-50">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => changeLanguage(lang.code)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors",
                i18n.language === lang.code
                  ? "bg-gold-400/15 text-gold-300"
                  : "text-text-secondary hover:bg-cosmos-800/50 hover:text-text-primary"
              )}
            >
              <span lang={lang.code} style={{ fontFamily: lang.fontFamily }} className="font-medium">{lang.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
