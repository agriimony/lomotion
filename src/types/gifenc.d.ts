declare module "gifenc" {
  export type GIFPalette = number[][] | Uint8Array;

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
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
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
  ): number[][];
  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: GIFPalette,
    format?: "rgb565" | "rgb444" | "rgba4444",
  ): Uint8Array;
}
