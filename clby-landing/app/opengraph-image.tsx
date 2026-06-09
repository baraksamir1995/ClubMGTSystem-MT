import { ImageResponse } from "next/og";

export const alt = "CLBY — Gym & Club Management Software for MENA";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#0A0A0A",
          color: "#F5F5F2",
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 40,
            fontWeight: 900,
            letterSpacing: "-0.02em",
          }}
        >
          CLBY
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 88,
              fontWeight: 800,
              lineHeight: 1.02,
              letterSpacing: "-0.03em",
            }}
          >
            Club management,
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 88,
              fontWeight: 800,
              lineHeight: 1.02,
              letterSpacing: "-0.03em",
              color: "#B8FF2E",
            }}
          >
            simplified.
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 28,
              fontSize: 32,
              color: "rgba(245,245,242,0.7)",
              maxWidth: 900,
              lineHeight: 1.3,
            }}
          >
            The all-in-one gym platform built for MENA — branded member app, QR
            check-in, bookings, payments & reports.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 26,
            color: "rgba(245,245,242,0.6)",
          }}
        >
          <div
            style={{
              display: "flex",
              width: 14,
              height: 14,
              borderRadius: 14,
              backgroundColor: "#B8FF2E",
            }}
          />
          clbyapp.com · Made in Cairo
        </div>
      </div>
    ),
    { ...size },
  );
}
