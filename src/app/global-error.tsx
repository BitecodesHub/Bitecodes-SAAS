"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void error.digest;
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: "#fbfaf8",
          color: "#201f26",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <main
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: "24px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "560px",
              border: "1px solid #e4e1e8",
              borderRadius: "24px",
              background: "white",
              padding: "40px",
              textAlign: "center",
              boxSizing: "border-box",
            }}
          >
            <p
              style={{
                margin: 0,
                color: "#5b45bd",
                fontSize: "13px",
                fontWeight: 700,
                letterSpacing: "0.14em",
              }}
            >
              BITECODES
            </p>
            <h1
              style={{ margin: "20px 0 0", fontSize: "32px", lineHeight: 1.15 }}
            >
              We hit an unexpected problem
            </h1>
            <p
              style={{
                margin: "14px auto 0",
                maxWidth: "430px",
                color: "#696571",
                lineHeight: 1.65,
              }}
            >
              The application shell could not finish loading. Retry safely, or
              return to the homepage.
            </p>
            <div
              style={{
                marginTop: "28px",
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: "12px",
              }}
            >
              <button
                type="button"
                onClick={reset}
                style={{
                  border: 0,
                  borderRadius: "999px",
                  background: "#5540b9",
                  color: "white",
                  padding: "13px 22px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Try again
              </button>
              <Link
                href="/"
                style={{
                  border: "1px solid #d9d5df",
                  borderRadius: "999px",
                  color: "#201f26",
                  padding: "12px 22px",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                Back to home
              </Link>
            </div>
            {error.digest ? (
              <p
                style={{
                  marginTop: "24px",
                  color: "#817c88",
                  fontSize: "12px",
                }}
              >
                Reference: {error.digest}
              </p>
            ) : null}
          </div>
        </main>
      </body>
    </html>
  );
}
