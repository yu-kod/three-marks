import type { GuestSession } from "@app/identity-client";
import { GuestProvider } from "@app/identity-client/react";
import { render, type RenderOptions } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement, ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { newcomer } from "./guest";

type Options = Omit<RenderOptions, "wrapper"> & {
  /** 表示を始める URL */
  route?: string;
  /** ゲストのセッション。省略するとまだゲストでない状態 */
  guestSession?: GuestSession;
};

/** ルーターとゲストなど、アプリ全体で必要な Provider で包んで描画する */
export function renderWithProviders(
  ui: ReactElement,
  { route = "/", guestSession = newcomer().session, ...options }: Options = {}
) {
  function Providers({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={[route]}>
        <GuestProvider session={guestSession}>{children}</GuestProvider>
      </MemoryRouter>
    );
  }
  return { user: userEvent.setup(), ...render(ui, { wrapper: Providers, ...options }) };
}
