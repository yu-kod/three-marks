import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { newcomer, returning } from "@/test-utils/guest";
import { renderWithProviders } from "@/test-utils/render";
import HomePage from "./HomePage";

describe("HomePage", () => {
  it("初めての人にも名前の入力欄を出さず、すぐ始められるボタンだけを出す", async () => {
    renderWithProviders(<HomePage />);

    expect(await screen.findByRole("button", { name: "はじめる" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("はじめるを押すと名前を聞かずにゲストになり、付いた名前と変え方を伝える", async () => {
    const { session, sent } = newcomer();
    const { user } = renderWithProviders(<HomePage />, { guestSession: session });

    await user.click(await screen.findByRole("button", { name: "はじめる" }));

    expect(sent("POST /api/guests")).toEqual([{}]);
    expect(await screen.findByText("ようこそ、ねむいペンギン さん")).toBeInTheDocument();
    expect(screen.getByText(/名前は右上からいつでも変えられます/)).toBeInTheDocument();
  });

  it("前に来たことがある人は、同じ名前で迎える", async () => {
    renderWithProviders(<HomePage />, { guestSession: returning().session });

    expect(await screen.findByText("ようこそ、ねむいペンギン さん")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "はじめる" })).not.toBeInTheDocument();
  });

  it("登録に失敗したらその旨を出し、もう一度押せる", async () => {
    const { session } = newcomer({
      "POST /api/guests": () => {
        throw new TypeError("offline");
      },
    });
    const { user } = renderWithProviders(<HomePage />, { guestSession: session });

    await user.click(await screen.findByRole("button", { name: "はじめる" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("はじめられなかった");
    expect(screen.getByRole("button", { name: "はじめる" })).toBeEnabled();
  });

  it("前回のゲストを読み込めなかったら、その旨を出す", async () => {
    const { session } = returning(undefined, {
      "GET /api/guests/me": () => {
        throw new TypeError("offline");
      },
    });
    renderWithProviders(<HomePage />, { guestSession: session });

    expect(await screen.findByRole("alert")).toHaveTextContent("サーバーに接続できない");
  });
});
