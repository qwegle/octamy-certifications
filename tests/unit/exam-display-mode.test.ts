import { describe, expect, it } from "@jest/globals";
import {
  isMobileExamBrowser,
  shouldEnforceExamFullscreen,
  supportsBrowserFullscreen,
} from "../../client/src/lib/exam-display-mode";

const documentWithFullscreen = {
  documentElement: { requestFullscreen: async () => undefined },
} as unknown as Document;

const documentWithoutFullscreen = {
  documentElement: {},
} as Document;

function browserWindow({
  width = 1440,
  coarse = false,
  touchPoints = 0,
  userAgent = "Desktop Browser",
} = {}) {
  return {
    innerWidth: width,
    matchMedia: () => ({ matches: coarse }),
    navigator: { maxTouchPoints: touchPoints, userAgent },
  } as unknown as Window;
}

describe("exam display mode", () => {
  it("keeps desktop fullscreen enforcement when the API is available", () => {
    expect(supportsBrowserFullscreen(documentWithFullscreen)).toBe(true);
    expect(shouldEnforceExamFullscreen(documentWithFullscreen, browserWindow())).toBe(true);
  });

  it("uses mobile exam mode on iPhone even when a fullscreen method is exposed", () => {
    const mobile = browserWindow({
      width: 390,
      coarse: true,
      touchPoints: 5,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile",
    });
    expect(isMobileExamBrowser(mobile)).toBe(true);
    expect(shouldEnforceExamFullscreen(documentWithFullscreen, mobile)).toBe(false);
  });

  it("uses the fallback when the browser has no Fullscreen API", () => {
    expect(supportsBrowserFullscreen(documentWithoutFullscreen)).toBe(false);
    expect(shouldEnforceExamFullscreen(documentWithoutFullscreen, browserWindow())).toBe(false);
  });

  it("recognizes touch-first tablet browsers without a mobile user agent", () => {
    expect(isMobileExamBrowser(browserWindow({ width: 1024, coarse: true, touchPoints: 5 }))).toBe(true);
  });
});
