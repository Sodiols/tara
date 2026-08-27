import { captureException } from "@/lib/observability";

// Error boundaries report render failures, but browser event handlers,
// third-party callbacks and rejected promises can fail outside React. Install
// one process-wide pair of listeners so those failures reach the same scrubbed
// monitoring transport without adding a client monitoring SDK.
const marker = "__tara_observability_installed__";
const browser = window as unknown as Record<string, unknown>;

if (!browser[marker]) {
  browser[marker] = true;

  window.addEventListener("error", (event) => {
    captureException(event.error ?? new Error(event.message || "Unhandled browser error"), {
      operation: "browser.unhandled_error",
      tags: { source: "window.error" },
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    captureException(event.reason ?? new Error("Unhandled browser promise rejection"), {
      operation: "browser.unhandled_rejection",
      tags: { source: "window.unhandledrejection" },
    });
  });
}
