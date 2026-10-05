import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SkinnedGame } from "./SkinnedGame";
import { entranceScreen } from "@/test-utils/screens";

describe("SkinnedGame", () => {
  it("スキンを読み込めなければ、そう伝える", async () => {
    render(
      <SkinnedGame
        screen={entranceScreen()}
        loadSkin={async () => Promise.reject(new Error("404"))}
      />
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("画面を読み込めませんでした");
  });
});
