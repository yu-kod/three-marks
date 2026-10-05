import { Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { EntrancePage } from "./features/screens/EntrancePage";
import { RoomPage } from "./features/screens/RoomPage";
import NotFoundPage from "./pages/NotFoundPage";

export default function App() {
  return (
    <Routes>
      {/* ゲームの画面は Phaser が全画面に描く */}
      <Route path="/" element={<EntrancePage />} />
      <Route path="/r/:id" element={<RoomPage />} />
      <Route element={<AppLayout />}>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
