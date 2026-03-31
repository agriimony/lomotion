import { GIFEncoder, applyPalette } from "gifenc";
import { LCD_BLACK, LCD_GREEN } from "@/lib/palette";
import { drawPixelGrid } from "@/lib/grid";
import { LOGO_BITMAP, LOGO_OFFSET_X, LOGO_OFFSET_Y } from "@/lib/logo-mask";

export type CapturedFrame = {
  binary: Uint8Array;
  width: number;
  height: number;
};

export async function encodeGif(
  frames: CapturedFrame[],
  fps: number,
  onProgress?: (current: number, total: number, phase?: string) => void,
) {
  if (!frames.length) throw new Error("No frames to encode");

  const { width, height } = frames[0];
  const exportScale = 6;
  const gifWidth = width * exportScale;
  const gifHeight = height * exportScale;

  const palette: [number, number, number][] = [
    [0x96, 0xb5, 0x6f],
    [0x17, 0x19, 0x16],
  ];

  const gridOverlay = document.createElement("canvas");
  gridOverlay.width = gifWidth;
  gridOverlay.height = gifHeight;
  const gridCtx = gridOverlay.getContext("2d");
  if (!gridCtx) throw new Error("Grid canvas context unavailable");
  drawPixelGrid(gridCtx, width, height, exportScale, 1);

  const encoder = GIFEncoder();
  const delay = Math.round(1000 / fps);

  for (let frameIndex = 0; frameIndex < frames.length; frameIndex += 1) {
    onProgress?.(frameIndex + 1, frames.length, "encoding");
    const frame = frames[frameIndex];
    const canvas = document.createElement("canvas");
    canvas.width = gifWidth;
    canvas.height = gifHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas context unavailable");

    ctx.fillStyle = LCD_GREEN;
    ctx.fillRect(0, 0, gifWidth, gifHeight);

    ctx.fillStyle = LCD_BLACK;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const idx = y * width + x;
        if (!frame.binary[idx]) continue;
        ctx.fillRect(x * exportScale, y * exportScale, exportScale, exportScale);
      }
    }

    for (let y = 0; y < LOGO_BITMAP.length; y += 1) {
      const row = LOGO_BITMAP[y];
      for (let x = 0; x < row.length; x += 1) {
        if (row[x] !== "1") continue;
        const px = LOGO_OFFSET_X + x;
        const py = LOGO_OFFSET_Y + y;
        if (px < 0 || py < 0 || px >= width || py >= height) continue;
        const idx = py * width + px;
        ctx.fillStyle = frame.binary[idx] ? LCD_GREEN : LCD_BLACK;
        ctx.fillRect(px * exportScale, py * exportScale, exportScale, exportScale);
      }
    }

    ctx.drawImage(gridOverlay, 0, 0);

    const imageData = ctx.getImageData(0, 0, gifWidth, gifHeight);
    const indexed = applyPalette(imageData.data, palette, "rgb444");
    encoder.writeFrame(indexed, gifWidth, gifHeight, { palette, delay });

    if ((frameIndex + 1) % 2 === 0) {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    }
  }

  onProgress?.(frames.length, frames.length, "finalizing");
  encoder.finish();
  const bytes = encoder.bytesView();
  const output = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return new Blob([output], { type: "image/gif" });
}
