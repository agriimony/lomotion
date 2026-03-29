import GIF from "gif.js.optimized";
import { LCD_BLACK, LCD_GREEN } from "@/lib/palette";
import { drawPixelGrid } from "@/lib/grid";

export type CapturedFrame = {
  binary: Uint8Array;
  width: number;
  height: number;
};

export async function encodeGif(frames: CapturedFrame[], fps: number) {
  if (!frames.length) throw new Error("No frames to encode");

  const { width, height } = frames[0];
  const exportScale = 6;
  const gifWidth = width * exportScale;
  const gifHeight = height * exportScale;
  const gif = new GIF({
    workers: 2,
    quality: 1,
    width: gifWidth,
    height: gifHeight,
    workerScript: "/gif.worker.js",
    repeat: 0,
  });

  for (const frame of frames) {
    const canvas = document.createElement("canvas");
    canvas.width = gifWidth;
    canvas.height = gifHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context unavailable");

    ctx.fillStyle = LCD_BLACK;
    ctx.fillRect(0, 0, gifWidth, gifHeight);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const idx = y * width + x;
        ctx.fillStyle = frame.binary[idx] ? LCD_GREEN : LCD_BLACK;
        ctx.fillRect(x * exportScale, y * exportScale, exportScale, exportScale);
      }
    }
    drawPixelGrid(ctx, width, height, exportScale);
    gif.addFrame(canvas, { delay: Math.round(1000 / fps) });
  }

  return new Promise<Blob>((resolve, reject) => {
    gif.on("finished", (blob: Blob) => resolve(blob));
    gif.on("abort", () => reject(new Error("GIF encoding aborted")));
    gif.render();
  });
}

