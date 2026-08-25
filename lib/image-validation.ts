import "server-only";

import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "./product-images";

/**
 * Server-side image validation that does not take the browser's word for it.
 *
 * `file.type` on an uploaded File is whatever the client said it was. A request
 * built by hand can claim `image/jpeg` for an HTML document, an SVG full of
 * script, or a polyglot file that is a valid GIF *and* valid JavaScript. The
 * bucket is public, so anything stored in it is served straight back to
 * browsers from the Supabase Storage origin — which makes "is this actually a
 * picture?" a question worth answering before the upload, not after.
 *
 * So every file is checked three ways:
 *
 *   1. the declared type must be one we accept at all;
 *   2. the first bytes must match that type's real signature;
 *   3. the dimensions parsed out of those bytes must be plausible.
 *
 * SVG stays rejected. It is a document format that can carry <script> and
 * external references, and serving one from the same origin as the storefront
 * would be a stored-XSS primitive. There is no product photography reason to
 * accept it.
 *
 * WHAT THIS DOES NOT DO
 * ---------------------
 * It does not re-encode, strip EXIF, or generate thumbnails. Doing that
 * properly needs a native image pipeline (sharp), which is a heavyweight
 * dependency that does not run on every deployment target this project has to
 * support. Instead:
 *
 *   * orientation and metadata are handled at delivery time by next/image,
 *     which re-encodes to AVIF/WebP and does not carry EXIF through;
 *   * responsive sizes come from the `sizes` attribute on each <Image>, so a
 *     phone is never sent the full-resolution original;
 *   * an unreasonably large original is refused outright by the dimension cap
 *     below rather than accepted and downscaled.
 *
 * See docs/PRODUCTION.md for what changes if sharp is added later.
 */

/** A 6000px original is already more than any layout on the site can use. */
export const MAX_IMAGE_DIMENSION = 6000;
/** Below this, an image is a mistake rather than product photography. */
export const MIN_IMAGE_DIMENSION = 200;

export interface ImageInspection {
  ok: boolean;
  /** The type proven by the file's own bytes, not the one the browser claimed. */
  detectedType?: string;
  width?: number;
  height?: number;
  /** A message safe to show to a staff member. */
  reason?: string;
}

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  );
}

function readUint16BE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  );
}

/** PNG: 8-byte signature, then an IHDR chunk carrying width and height. */
function inspectPng(bytes: Uint8Array): ImageInspection | null {
  if (!startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return null;
  if (bytes.length < 24) return { ok: false, reason: "The PNG file is truncated." };
  return {
    ok: true,
    detectedType: "image/png",
    width: readUint32BE(bytes, 16),
    height: readUint32BE(bytes, 20),
  };
}

/** JPEG: walk the segment markers to the SOF frame header. */
function inspectJpeg(bytes: Uint8Array): ImageInspection | null {
  if (!startsWith(bytes, [0xff, 0xd8, 0xff])) return null;

  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    // SOF0..SOF15, excluding the non-frame markers in that range.
    const isFrameHeader =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrameHeader) {
      return {
        ok: true,
        detectedType: "image/jpeg",
        height: readUint16BE(bytes, offset + 5),
        width: readUint16BE(bytes, offset + 7),
      };
    }
    const segmentLength = readUint16BE(bytes, offset + 2);
    if (segmentLength < 2) break;
    offset += 2 + segmentLength;
  }

  return { ok: false, reason: "The JPEG file is malformed." };
}

/** WebP: RIFF container, then a VP8 / VP8L / VP8X chunk. */
function inspectWebp(bytes: Uint8Array): ImageInspection | null {
  if (!startsWith(bytes, [0x52, 0x49, 0x46, 0x46])) return null; // "RIFF"
  if (!startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return null; // "WEBP"
  if (bytes.length < 30) return { ok: false, reason: "The WebP file is truncated." };

  const chunk = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);

  if (chunk === "VP8X") {
    // 24-bit little-endian, stored as (dimension - 1).
    const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
    const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
    return { ok: true, detectedType: "image/webp", width, height };
  }
  if (chunk === "VP8 ") {
    return {
      ok: true,
      detectedType: "image/webp",
      width: readUint32LE(bytes, 26) & 0x3fff,
      height: (readUint32LE(bytes, 28) >> 0) & 0x3fff,
    };
  }
  if (chunk === "VP8L") {
    const packed = readUint32LE(bytes, 21);
    return {
      ok: true,
      detectedType: "image/webp",
      width: 1 + (packed & 0x3fff),
      height: 1 + ((packed >> 14) & 0x3fff),
    };
  }

  return { ok: false, reason: "The WebP file uses an unsupported variant." };
}

/**
 * AVIF: an ISO-BMFF file whose `ftyp` brand is avif or avis.
 *
 * The dimensions live inside the meta box, which needs a full box parser to
 * reach. The signature check is what matters for security — it proves the file
 * is not HTML or a script — so the dimension check is skipped for AVIF and the
 * byte-size cap does the rest.
 */
function inspectAvif(bytes: Uint8Array): ImageInspection | null {
  if (!startsWith(bytes, [0x66, 0x74, 0x79, 0x70], 4)) return null; // "ftyp"
  const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  if (brand !== "avif" && brand !== "avis") return null;
  return { ok: true, detectedType: "image/avif" };
}

/**
 * Inspects the file's own bytes and returns whether it may be stored.
 *
 * The declared MIME type must match the detected one: a PNG uploaded as
 * `image/jpeg` is refused rather than quietly stored with a `.jpg` name and a
 * `Content-Type` the browser will disbelieve.
 */
export async function inspectImageFile(file: File): Promise<ImageInspection> {
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, reason: "Only JPEG, PNG, WebP or AVIF images are allowed." };
  }
  if (file.size === 0) {
    return { ok: false, reason: "That file is empty." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      reason: `Each image must be smaller than ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))} MB.`,
    };
  }

  // The header is enough for every format above; the whole file is never held
  // in memory twice.
  const header = new Uint8Array(await file.slice(0, 64 * 1024).arrayBuffer());

  const inspection =
    inspectPng(header) ??
    inspectJpeg(header) ??
    inspectWebp(header) ??
    inspectAvif(header);

  if (!inspection) {
    return {
      ok: false,
      reason: "That file is not a JPEG, PNG, WebP or AVIF image.",
    };
  }
  if (!inspection.ok) return inspection;

  if (inspection.detectedType !== file.type) {
    return {
      ok: false,
      reason: "That file's contents do not match its type. Re-export it and try again.",
    };
  }

  const { width, height } = inspection;
  if (width != null && height != null) {
    if (width < MIN_IMAGE_DIMENSION || height < MIN_IMAGE_DIMENSION) {
      return {
        ok: false,
        reason: `Product images must be at least ${MIN_IMAGE_DIMENSION}px on each side.`,
      };
    }
    if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
      return {
        ok: false,
        reason: `Product images must be no more than ${MAX_IMAGE_DIMENSION}px on each side. Resize and try again.`,
      };
    }
  }

  return inspection;
}
