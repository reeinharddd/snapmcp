declare module "gifenc/dist/gifenc.esm.js" {
  export interface GIFEncoderOptions {
    initialCapacity?: number;
    auto?: boolean;
  }

  export interface WriteFrameOptions {
    /** Delay in milliseconds. gifenc converts it to centiseconds. */
    delay?: number;
    palette?: Uint8Array;
    transparent?: boolean;
    transparentIndex?: number;
    colorDepth?: number;
    /** -1 plays once, 0 loops forever, >0 is a finite repeat count. */
    repeat?: number;
  }

  export class GIFEncoder {
    constructor(options?: GIFEncoderOptions);
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
