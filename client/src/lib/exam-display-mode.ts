type BrowserWindow = Pick<Window, "innerWidth" | "matchMedia"> & {
  navigator?: Pick<Navigator, "maxTouchPoints" | "userAgent">;
};

type BrowserDocument = Pick<Document, "documentElement">;

const MOBILE_USER_AGENT = /Android|iPhone|iPad|iPod|Mobile/i;

export function supportsBrowserFullscreen(
  browserDocument: BrowserDocument | null = typeof document === "undefined" ? null : document,
) {
  return typeof browserDocument?.documentElement?.requestFullscreen === "function";
}

export function isMobileExamBrowser(
  browserWindow: BrowserWindow | null = typeof window === "undefined"
    ? null
    : {
        innerWidth: window.innerWidth,
        matchMedia: window.matchMedia.bind(window),
        navigator: window.navigator,
      },
) {
  if (!browserWindow) return false;
  const userAgent = browserWindow.navigator?.userAgent ?? "";
  const touchFirst = (browserWindow.navigator?.maxTouchPoints ?? 0) > 0
    || browserWindow.matchMedia?.("(pointer: coarse)")?.matches === true;
  return MOBILE_USER_AGENT.test(userAgent) || (touchFirst && browserWindow.innerWidth <= 1366);
}

/**
 * Mobile browsers, notably iPhone Safari, do not consistently expose or honor
 * the Fullscreen API for ordinary page elements. They use the responsive
 * full-viewport exam shell while desktop browser-evidence exams retain the
 * fullscreen requirement.
 */
export function shouldEnforceExamFullscreen(
  browserDocument: BrowserDocument | null = typeof document === "undefined" ? null : document,
  browserWindow?: BrowserWindow | null,
) {
  return supportsBrowserFullscreen(browserDocument) && !isMobileExamBrowser(browserWindow);
}
