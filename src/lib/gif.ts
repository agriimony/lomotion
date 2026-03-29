import GIF from "gif.js.optimized";
import { LCD_BLACK, LCD_GREEN, WATERMARK_TEXT } from "@/lib/palette";
import { binaryToImageData } from "@/lib/quantize";

export type CapturedFrame = {
  binary: Uint8Array;
  width: number;
  height: number;
};

export async function encodeGif(frames: CapturedFrame[], fps: number) {
  if (!frames.length) throw new Error("No frames to encode");

  const { width, height } = frames[0];
  const gif = new GIF({
    workers: 2,
    quality: 1,
    width,
    height,
    workerScript: "/gif.worker.js",
    repeat: 0,
  });

  for (const frame of frames) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context unavailable");

    const imageData = binaryToImageData(frame.binary, width, height);
    ctx.putImageData(imageData, 0, 0);
    drawWatermark(ctx, width, height);
    gif.addFrame(canvas, { delay: Math.round(1000 / fps) });
  }

  return new Promise<Blob>((resolve, reject) => {
    gif.on("finished", (blob: Blob) => resolve(blob));
    gif.on("abort", () => reject(new Error("GIF encoding aborted")));
    gif.render();
  });
}

function drawWatermark(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.save();
  ctx.font = `${Math.max(5, Math.floor(width / 14))}px monospace`;
  ctx.textBaseline = "top";
  ctx.fillStyle = LCD_BLACK;
  ctx.fillRect(2, 2, Math.ceil(ctx.measureText(WATERMARK_TEXT).width) + 4, Math.max(8, Math.floor(height / 7)));
  ctx.fillStyle = LCD_GREEN;
  ctx.fillText(WATERMARK_TEXT, 4, 3);
  ctx.restore();
}
