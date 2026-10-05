import { Link, Outlet } from "react-router-dom";
import { GuestNameChip } from "@/features/guest/GuestNameChip";

/** 全ページ共通の枠。ヘッダーの右に自分の名前を出し、どこからでも変えられるようにする */
export function AppLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between gap-4 border-b px-4 py-2">
        <Link to="/" className="shrink-0 font-bold whitespace-nowrap">
          Three Marks
        </Link>
        <GuestNameChip />
      </header>
      <Outlet />
    </div>
  );
}
