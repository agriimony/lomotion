import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#171916",
          color: "#96b56f",
          fontSize: 88,
          fontFamily: "monospace",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        LoMotion
      </div>
    ),
    {
      width: 1200,
      height: 800,
    },
  );
}
