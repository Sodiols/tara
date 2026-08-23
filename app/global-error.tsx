"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary: catches an error thrown by the root layout itself,
 * where no provider, font variable or stylesheet can be relied upon. It
 * therefore renders its own <html>/<body> and uses inline styles only.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[root] unhandled error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F5F1EA",
          color: "#171717",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          padding: "24px",
          textAlign: "center",
        }}
      >
        <main style={{ maxWidth: "480px" }}>
          <p
            style={{
              margin: 0,
              fontSize: "12px",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#702D42",
            }}
          >
            TARA
          </p>
          <h1 style={{ margin: "12px 0 0", fontSize: "28px", fontWeight: 500 }}>
            The site could not be loaded
          </h1>
          <p style={{ margin: "12px 0 0", fontSize: "14px", lineHeight: 1.6, opacity: 0.7 }}>
            Something failed before the page could start. Please try again in a moment.
          </p>
          {error.digest && (
            <p style={{ margin: "12px 0 0", fontSize: "12px", opacity: 0.55 }}>
              Reference: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "24px",
              height: "48px",
              padding: "0 28px",
              border: "1px solid #702D42",
              borderRadius: "6px",
              background: "#702D42",
              color: "#F5F1EA",
              fontSize: "13px",
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
