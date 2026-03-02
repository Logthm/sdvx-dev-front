import { Loader2 } from "lucide-react";
import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { InstallPrompt } from "./components/ui/InstallPrompt";

const BrowserPage = lazy(() =>
  import("./pages/BrowserPage").then((m) => ({ default: m.BrowserPage })),
);
const SongDetailPage = lazy(() =>
  import("./pages/SongDetailPage").then((m) => ({ default: m.SongDetailPage })),
);

export function App() {
  return (
    <>
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-[100dvh] bg-cosmos-950">
            <Loader2 size={28} className="animate-spin text-accent" />
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<BrowserPage />} />
          <Route path="/song/:musicId" element={<SongDetailPage />} />
        </Routes>
      </Suspense>
      <InstallPrompt />
    </>
  );
}
