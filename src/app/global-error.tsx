"use client";

import { useEffect } from "react";

// Replaces the root layout when it fails, so no translations or providers
// are available here. Keep it plain and bilingual.
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: 24,
        }}
      >
        <div>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>Something went wrong</h1>
          <p dir="rtl" lang="ur" style={{ marginBottom: 16 }}>
            کچھ غلط ہو گیا
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: "#15803d",
              color: "white",
              cursor: "pointer",
            }}
          >
            Try again / دوبارہ کوشش کریں
          </button>
        </div>
      </body>
    </html>
  );
}
