declare module "gifenc" {
  export type RGB = [number, number, number];
  export type RGBA = [number, number, number, number];
  export type GIFPalette = RGB[] | RGBA[] | Uint8Array<ArrayBuffer>;
  export type GIFBytes = Uint8Array<ArrayBuffer>;

  export type GIFEncoderOptions = {
    auto?: boolean;
    initialCapacity?: number;
  };

  export type WriteFrameOptions = {
    palette?: GIFPalette;
    first?: boolean;
    transparent?: boolean;
    transparentIndex?: number;
    delay?: number;
    repeat?: number;
    dispose?: number;
  };

  export type GIFEncoderInstance = {
    writeFrame(index: Uint8Array, width: number, height: number, opts?: WriteFrameOptions): void;
    finish(): void;
    bytes(): GIFBytes;
    bytesView(): GIFBytes;
    writeHeader(): void;
    reset(): void;
    buffer: ArrayBuffer;
    stream: {
      writeByte(byte: number): void;
      writeBytes(bytes: ArrayLike<number>, offset?: number, byteLength?: number): void;
    };
  };

  export function GIFEncoder(opts?: GIFEncoderOptions): GIFEncoderInstance;
  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: {
      format?: "rgb565" | "rgb444" | "rgba4444";
      oneBitAlpha?: boolean | number;
      clearAlpha?: boolean;
      clearAlphaThreshold?: number;
      clearAlphaColor?: number;
    },
  ): GIFPalette;
  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: GIFPalette,
    format?: "rgb565" | "rgb444" | "rgba4444",
  ): GIFBytes;
}
