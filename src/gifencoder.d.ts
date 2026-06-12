declare module "gifencoder" {
  import { Readable } from "node:stream"

  class GIFEncoder {
    constructor(width: number, height: number)

    start(): void
    addFrame(imageData: Buffer): void
    finish(): void

    setDelay(milliseconds: number): void
    setFrameRate(fps: number): void
    setRepeat(repeat: number): void
    setQuality(quality: number): void
    setTransparent(color: number | null): void
    setDispose(disposalCode: number): void

    createReadStream(): Readable
    createWriteStream(options?: Record<string, unknown>): NodeJS.WritableStream
  }

  export default GIFEncoder
}
