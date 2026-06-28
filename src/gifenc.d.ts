declare module "gifenc/dist/gifenc.esm.js" {
  export interface GIFEncoderOptions {
    loop?: boolean;
    dither?: boolean;
  }

  export interface WriteFrameOptions {
    delay?: number;
    palette?: Uint8Array;
    transparent?: boolean;
    transparentIndex?: number;
    colorDepth?: number;
  }

  export class GIFEncoder {
    constructor(width: number, height: number, options?: GIFEncoderOptions);
    writeFrame(
      data: Uint8Array,
      width: number,
      height: number,
      options?: WriteFrameOptions,
    ): void;
    finish(): void;
    bytes(): Uint8Array;
  }

  type RgbTriple = [number, number, number];

  export function quantize(
    data: Uint8Array,
    colors: number,
    options?: Record<string, unknown>,
  ): RgbTriple[];

  export function applyPalette(
    data: Uint8Array,
    palette: RgbTriple[],
    format?: string,
  ): Uint8Array;
}
