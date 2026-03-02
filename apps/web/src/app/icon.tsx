import { ImageResponse } from "next/og";

export const size = { width: 256, height: 256 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: 256,
        height: 256,
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
      }}
    >
      {/* Solid Black Drop Shadow */}
      <div
        style={{
          position: "absolute",
          top: 40,
          left: 40,
          width: 200,
          height: 200,
          backgroundColor: "black",
        }}
      />
      {/* Main Amber Box */}
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          width: 200,
          height: 200,
          backgroundColor: "#f59e0b",
          border: "16px solid #111111",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Lucide Activity Icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="120"
          height="120"
          viewBox="0 0 24 24"
          fill="none"
          stroke="black"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />
        </svg>
      </div>
    </div>,
    {
      ...size,
    },
  );
}
