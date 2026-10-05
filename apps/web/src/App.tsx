import { Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { TablePage } from "./features/table/TablePage";
import HomePage from "./pages/HomePage";
import NotFoundPage from "./pages/NotFoundPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      {/* ゲーム画面は Phaser が全画面に描く */}
      <Route path="/r/:id" element={<TablePage />} />
    </Routes>
  );
}
