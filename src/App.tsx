import { Route, Routes } from "react-router-dom";
import { BrowserPage } from "./pages/BrowserPage";
import { SongDetailPage } from "./pages/SongDetailPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<BrowserPage />} />
      <Route path="/song/:musicId" element={<SongDetailPage />} />
    </Routes>
  );
}
