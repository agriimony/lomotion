import GIF from "gif.js.optimized";
import { LCD_BLACK, LCD_GREEN } from "@/lib/palette";
import { drawPixelGrid } from "@/lib/grid";

export type CapturedFrame = {
  binary: Uint8Array;
  width: number;
  height: number;
};

export async function encodeGif(frames: CapturedFrame[], fps: number, ghostOpacity = 0) {
  if (!frames.length) throw new Error("No frames to encode");

  const { width, height } = frames[0];
  const exportScale = 4;
  const gifWidth = width * exportScale;
  const gifHeight = height * exportScale;
  const gridOverlay = document.createElement("canvas");
  gridOverlay.width = gifWidth;
  gridOverlay.height = gifHeight;
  const gridCtx = gridOverlay.getContext("2d");
  if (!gridCtx) throw new Error("Grid canvas context unavailable");
  drawPixelGrid(gridCtx, width, height, exportScale);

  const gif = new GIF({
    workers: 2,
    quality: 1,
    width: gifWidth,
    height: gifHeight,
    workerScript: "/gif.worker.js",
    repeat: 0,
  });

  for (let frameIndex = 0; frameIndex < frames.length; frameIndex += 1) {
    const frame = frames[frameIndex];
    const prev = frameIndex > 0 ? frames[frameIndex - 1] : null;
    const canvas = document.createElement("canvas");
    canvas.width = gifWidth;
    canvas.height = gifHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context unavailable");

    ctx.fillStyle = LCD_BLACK;
    ctx.fillRect(0, 0, gifWidth, gifHeight);

    if (prev && ghostOpacity > 0) {
      ctx.save();
      ctx.globalAlpha = ghostOpacity;
      ctx.fillStyle = LCD_BLACK;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const idx = y * width + x;
          if (!prev.binary[idx]) continue;
          ctx.fillRect(x * exportScale, y * exportScale, exportScale, exportScale);
        }
      }
      ctx.restore();
    }

    ctx.fillStyle = LCD_GREEN;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const idx = y * width + x;
        if (!frame.binary[idx]) continue;
        ctx.fillRect(x * exportScale, y * exportScale, exportScale, exportScale);
      }
    }

    ctx.drawImage(gridOverlay, 0, 0);
    gif.addFrame(canvas, { delay: Math.round(1000 / fps) });
  }

  return new Promise<Blob>((resolve, reject) => {
    gif.on("finished", (blob: Blob) => resolve(blob));
    gif.on("abort", () => reject(new Error("GIF encoding aborted")));
    gif.render();
  });
}
