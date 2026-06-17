import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeQueryMode,
  pickInitialMode,
  resolveIsMobile,
  isMobileUserAgent,
  MOBILE_MAX_WIDTH,
} from "./useDevice";

describe("useDevice 纯判定", () => {
  describe("normalizeQueryMode", () => {
    it("h5 / m / mobile → mobile", () => {
      for (const v of ["h5", "m", "mobile", "MOBILE", " H5 "]) {
        assert.equal(normalizeQueryMode(v), "mobile");
      }
    });
    it("pc / desktop / web → desktop", () => {
      for (const v of ["pc", "desktop", "web", "PC"]) {
        assert.equal(normalizeQueryMode(v), "desktop");
      }
    });
    it("空值或无法识别 → null", () => {
      assert.equal(normalizeQueryMode(null), null);
      assert.equal(normalizeQueryMode(""), null);
      assert.equal(normalizeQueryMode("tablet"), null);
    });
  });

  describe("pickInitialMode（优先级 URL > localStorage > auto）", () => {
    it("URL 参数最高优先，盖过 localStorage", () => {
      assert.equal(pickInitialMode("desktop", "mobile"), "desktop");
      assert.equal(pickInitialMode("h5", "desktop"), "mobile");
    });
    it("无 URL 参数时回落到 localStorage", () => {
      assert.equal(pickInitialMode(null, "mobile"), "mobile");
      assert.equal(pickInitialMode("garbage", "desktop"), "desktop");
    });
    it("都没有时回落到 auto", () => {
      assert.equal(pickInitialMode(null, null), "auto");
      assert.equal(pickInitialMode(null, "junk"), "auto");
    });
  });

  describe("resolveIsMobile（显式覆盖盖过自动信号）", () => {
    it("显式 mobile 恒为真，哪怕宽屏桌面 UA", () => {
      assert.equal(resolveIsMobile("mobile", { uaMobile: false, width: 1920 }), true);
    });
    it("显式 desktop 恒为假，哪怕窄屏移动 UA", () => {
      assert.equal(resolveIsMobile("desktop", { uaMobile: true, width: 320 }), false);
    });
    it("auto：移动 UA 即移动，无论宽度", () => {
      assert.equal(resolveIsMobile("auto", { uaMobile: true, width: 1920 }), true);
    });
    it("auto：窄于阈值即移动", () => {
      assert.equal(resolveIsMobile("auto", { uaMobile: false, width: MOBILE_MAX_WIDTH - 1 }), true);
      assert.equal(resolveIsMobile("auto", { uaMobile: false, width: MOBILE_MAX_WIDTH }), false);
      assert.equal(resolveIsMobile("auto", { uaMobile: false, width: 1280 }), false);
    });
  });

  describe("isMobileUserAgent", () => {
    it("识别常见移动 UA", () => {
      assert.equal(isMobileUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"), true);
      assert.equal(isMobileUserAgent("Mozilla/5.0 (Linux; Android 14)"), true);
    });
    it("桌面 UA 为假", () => {
      assert.equal(isMobileUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"), false);
      assert.equal(isMobileUserAgent(""), false);
    });
  });
});
