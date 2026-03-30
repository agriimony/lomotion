import { LCD_GREEN } from "@/lib/palette";

export function drawPixelGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scale: number,
  lineWidth = 1,
) {
  ctx.save();
  ctx.strokeStyle = LCD_GREEN;
  ctx.lineWidth = lineWidth;

  for (let x = 0; x <= width; x += 1) {
    const px = Math.round(x * scale) + 0.5;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, Math.round(height * scale));
    ctx.stroke();
  }

  for (let y = 0; y <= height; y += 1) {
    const py = Math.round(y * scale) + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(Math.round(width * scale), py);
    ctx.stroke();
  }

  ctx.restore();
}
