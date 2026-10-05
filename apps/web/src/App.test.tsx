import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import App from "./App";
import { returning } from "./test-utils/guest";
import { renderWithProviders } from "./test-utils/render";

describe("App", () => {
  it("/ でトップページを表示する", async () => {
    renderWithProviders(<App />, { route: "/" });

    expect(await screen.findByRole("button", { name: "はじめる" })).toBeInTheDocument();
  });

  it("どのページでも、ヘッダーに自分の名前が出る", async () => {
    renderWithProviders(<App />, { route: "/no-such-page", guestSession: returning().session });

    const header = screen.getByRole("banner");
    expect(header).toHaveTextContent("Three Marks");
    expect(
      await screen.findByRole("button", { name: "名前を変える（今: ねむいペンギン）" })
    ).toBeInTheDocument();
  });

  it("存在しない URL では「ページが見つからない」を表示し、トップへ戻れる", async () => {
    const { user } = renderWithProviders(<App />, { route: "/no-such-page" });

    expect(screen.getByRole("heading", { name: "ページが見つからない" })).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "トップへ戻る" }));

    expect(await screen.findByRole("button", { name: "はじめる" })).toBeInTheDocument();
  });

  it("招待 URL（/r/:id）はヘッダー無しの全画面でゲーム画面を開く", async () => {
    // ここでは通信しない。スキンが読めないときの表示で、ゲーム画面のルートに来たことを確かめる
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));

    renderWithProviders(<App />, { route: "/r/room-1" });

    expect(await screen.findByRole("alert")).toHaveTextContent("画面を読み込めませんでした");
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
  });
});
