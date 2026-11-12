/**
 * Office document writers for snapmcp.
 *
 * Produces editable PowerPoint decks and Word documents from the same
 * captioned sections used by the Markdown, HTML, and PDF outputs. Text stays
 * real text in both formats, so the result can be edited instead of being a
 * screenshot of a document.
 *
 * @module
 */

import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import * as PptxGenJSModule from "pptxgenjs"
import { Document, HeadingLevel, ImageRun, Packer, Paragraph, TextRun } from "docx"
import { logger } from "./logger.js"

/**
 * Constructor type of pptxgenjs.
 *
 * The package ships CommonJS type declarations, so its class is only reachable
 * through the nested default export of the module type.
 */
type PptxGenJSConstructor = typeof PptxGenJSModule.default.default

// The CommonJS build is loaded explicitly because the package publishes
// CommonJS types while exposing an ES module at runtime.
const require = createRequire(import.meta.url)
const PptxGenJS = require("pptxgenjs") as PptxGenJSConstructor

/** An image that has already been read and validated. */
export interface OfficeImage {
  /** Absolute path the image was read from. */
  filePath: string
  /** Raw image bytes. */
  buffer: Buffer
  /** MIME type detected from the file signature. */
  mimeType: string
  /** Size of the image in bytes. */
  byteLength: number
  /** Pixel width, when it could be read from the image header. */
  width?: number
  /** Pixel height, when it could be read from the image header. */
  height?: number
}

/** One section of an Office document. */
export interface OfficeSection {
  /** Section heading. */
  title?: string
  /** Descriptive paragraph. */
  description?: string
  /** Image embedded in the section. */
  image?: OfficeImage
  /** Caption shown under the image. */
  caption?: string
  /** Code block rendered in a monospace block. */
  code?: string
  /** Programming language of the code block. */
  codeLanguage?: string
}

/** Options for the Office writers. */
export interface OfficeOptions {
  /** Document title. */
  title: string
  /** Ordered sections. */
  sections: OfficeSection[]
  /** Absolute output path. */
  outputPath: string
  /** Include a generation timestamp. */
  includeTimestamps?: boolean
}

// ─── Layout constants ─────────────────────────────────────────

/** Slide size in inches for a 16:9 deck. */
const SLIDE_WIDTH = 13.333
const SLIDE_HEIGHT = 7.5

/** Usable content box on a slide, in inches. */
const CONTENT_BOX = { x: 0.6, y: 2.2, w: 12.1, h: 4.2 }

/** Maximum width and height of an embedded Word image, in points. */
const DOCX_MAX_WIDTH = 468
const DOCX_MAX_HEIGHT = 600

/** Pixels per inch used to convert image pixels into Word points. */
const POINTS_PER_PIXEL = 0.75

/** Fallback dimensions for images whose header could not be read. */
const DEFAULT_IMAGE_WIDTH = 800
const DEFAULT_IMAGE_HEIGHT = 600

// ─── Helpers ───────────────────────────────────────────────────

/** Map a MIME type to the image type used by the Word writer. */
function docxImageType(mimeType: string): "png" | "jpg" | "gif" | null {
  if (mimeType === "image/png") return "png"
  if (mimeType === "image/jpeg") return "jpg"
  if (mimeType === "image/gif") return "gif"
  return null
}

/** Return the pixel size of an image, falling back to a sane default. */
function pixelSize(image: OfficeImage): { width: number; height: number } {
  const width = image.width && image.width > 0 ? image.width : DEFAULT_IMAGE_WIDTH
  const height = image.height && image.height > 0 ? image.height : DEFAULT_IMAGE_HEIGHT
  return { width, height }
}

/** Fit an image inside a box while preserving its aspect ratio. */
function fitInside(
  width: number,
  height: number,
  box: { x: number; y: number; w: number; h: number },
): { x: number; y: number; w: number; h: number } {
  const ratio = width / height
  let w = box.w
  let h = w / ratio
  if (h > box.h) {
    h = box.h
    w = h * ratio
  }
  return {
    x: box.x + (box.w - w) / 2,
    y: box.y + (box.h - h) / 2,
    w,
    h,
  }
}

/** Ensure the parent directory of the output file exists. */
function ensureOutputDirectory(outputPath: string): void {
  fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true })
}

// ─── PowerPoint ───────────────────────────────────────────────

/**
 * Write an editable PowerPoint deck.
 *
 * The deck has a title slide followed by one slide per section. Headings,
 * descriptions, and captions are real text boxes, and captures are embedded
 * as pictures that keep their aspect ratio.
 *
 * @param options Title, sections, and output path
 * @returns The output path
 */
export async function writePptx(options: OfficeOptions): Promise<string> {
  const { title, sections, outputPath, includeTimestamps } = options
  ensureOutputDirectory(outputPath)

  const pptx = new PptxGenJS()
  pptx.defineLayout({ name: "SNAPMCP_16x9", width: SLIDE_WIDTH, height: SLIDE_HEIGHT })
  pptx.layout = "SNAPMCP_16x9"
  pptx.title = title
  pptx.subject = "Generated with snapmcp"

  const titleSlide = pptx.addSlide()
  titleSlide.addText(title, {
    x: 0.8,
    y: 2.6,
    w: SLIDE_WIDTH - 1.6,
    h: 1.3,
    fontSize: 40,
    bold: true,
    align: "center",
    valign: "middle",
  })
  if (includeTimestamps) {
    titleSlide.addText(`Generated: ${new Date().toISOString()}`, {
      x: 0.8,
      y: 4,
      w: SLIDE_WIDTH - 1.6,
      h: 0.5,
      fontSize: 12,
      align: "center",
    })
  }

  for (const section of sections) {
    const slide = pptx.addSlide()

    if (section.title) {
      slide.addText(section.title, {
        x: 0.6,
        y: 0.35,
        w: SLIDE_WIDTH - 1.2,
        h: 0.75,
        fontSize: 28,
        bold: true,
      })
    }

    if (section.description) {
      slide.addText(section.description, {
        x: 0.6,
        y: 1.15,
        w: SLIDE_WIDTH - 1.2,
        h: 1,
        fontSize: 16,
      })
    }

    if (section.image) {
      const { width, height } = pixelSize(section.image)
      const placement = fitInside(width, height, CONTENT_BOX)
      slide.addImage({
        data: `data:${section.image.mimeType};base64,${section.image.buffer.toString("base64")}`,
        altText: section.caption ?? section.title ?? "capture",
        ...placement,
      })
      if (section.caption) {
        slide.addText(section.caption, {
          x: 0.6,
          y: 6.55,
          w: SLIDE_WIDTH - 1.2,
          h: 0.5,
          fontSize: 12,
          italic: true,
          align: "center",
        })
      }
    }

    if (section.code) {
      slide.addText(section.code, {
        x: 0.6,
        y: 4.6,
        w: SLIDE_WIDTH - 1.2,
        h: 1.8,
        fontSize: 12,
        fontFace: "Courier New",
      })
    }
  }

  await pptx.writeFile({ fileName: outputPath })
  logger.info(`PowerPoint document saved: ${outputPath}`)
  return outputPath
}

// ─── Word ─────────────────────────────────────────────────────

/**
 * Write an editable Word document.
 *
 * The document has a Heading 1 title followed by one Heading 2 per section,
 * with the description, capture, caption, and code block as normal content.
 *
 * @param options Title, sections, and output path
 * @returns The output path
 */
export async function writeDocx(options: OfficeOptions): Promise<string> {
  const { title, sections, outputPath, includeTimestamps } = options
  ensureOutputDirectory(outputPath)

  const children: Paragraph[] = [new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 })]

  if (includeTimestamps) {
    children.push(new Paragraph({ children: [new TextRun(`Generated: ${new Date().toISOString()}`)] }))
  }

  for (const section of sections) {
    if (section.title) {
      children.push(new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_2 }))
    }

    if (section.description) {
      children.push(new Paragraph({ children: [new TextRun(section.description)] }))
    }

    if (section.image) {
      const type = docxImageType(section.image.mimeType)
      if (!type) {
        logger.warn(
          `Skipping image in Word document, unsupported format: ${section.image.mimeType}`,
        )
      } else {
        const { width, height } = pixelSize(section.image)
        let targetWidth = width * POINTS_PER_PIXEL
        let targetHeight = height * POINTS_PER_PIXEL
        if (targetWidth > DOCX_MAX_WIDTH) {
          targetHeight = (targetHeight * DOCX_MAX_WIDTH) / targetWidth
          targetWidth = DOCX_MAX_WIDTH
        }
        if (targetHeight > DOCX_MAX_HEIGHT) {
          targetWidth = (targetWidth * DOCX_MAX_HEIGHT) / targetHeight
          targetHeight = DOCX_MAX_HEIGHT
        }
        children.push(
          new Paragraph({
            children: [
              new ImageRun({
                type,
                data: section.image.buffer,
                transformation: { width: Math.round(targetWidth), height: Math.round(targetHeight) },
              }),
            ],
          }),
        )
        if (section.caption) {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: section.caption, italics: true, size: 18 })],
            }),
          )
        }
      }
    }

    if (section.code) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: section.code,
              font: "Courier New",
              size: 18,
            }),
          ],
        }),
      )
    }
  }

  const document = new Document({ sections: [{ children }] })
  const buffer = await Packer.toBuffer(document)
  fs.writeFileSync(outputPath, buffer)
  logger.info(`Word document saved: ${outputPath}`)
  return outputPath
}
