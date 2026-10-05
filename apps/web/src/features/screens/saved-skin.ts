import { createJsonStorage } from "@app/web-core";
import { loadSkin, savedSkinId } from "@/game/skin/load-skin";

/** 端末に保存したスキンを読む */
export const loadSavedSkin = () =>
  loadSkin(savedSkinId(createJsonStorage()), { origin: window.location.origin });
