/**
 * Builds public/og/tara-default.png — the default Open Graph and Twitter image.
 *
 *     npm run og:generate
 *
 * WHAT IT IS
 * ----------
 * A 1200 x 630 composition of two assets TARA already ships, nothing invented:
 *
 *   left   the Deep Wine wordmark (public/logo/logo-meroon.png) on Soft Ivory
 *   right  the Festive collection photograph (public/images/collections/
 *          festive.webp) — the one frame in the campaign set with the model
 *          facing camera and a garment in the brand's own wine
 *
 * No text is rendered. Bodoni Moda and Manrope are loaded by next/font at
 * runtime and are not installed where this runs, so SVG text would silently
 * fall back to a system serif and put an off-brand typeface on every shared
 * link. The wordmark is already artwork, so it needs no font.
 *
 * WHY A COMMITTED FILE AND A SCRIPT
 * ---------------------------------
 * The PNG is committed so a deploy does not depend on running this. The script
 * is committed so the PNG is reproducible: swap a source asset, run it again,
 * and the card follows. `sharp` is not a direct dependency — it ships with
 * Next.js for image optimisation, which is what makes it available here.
 *
 * WHY 1200 x 630
 * --------------
 * 1.91:1 is what Facebook, LinkedIn and X's summary_large_image all render
 * uncropped. The wordmark sits in the left panel and the model in the right, so
 * both survive the centre crop some messaging apps apply to thumbnails.
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const from = (relative) => path.join(root, relative);

const WIDTH = 1200;
const HEIGHT = 630;
const PHOTO_WIDTH = 470;
const LOGO_WIDTH = 440;
const IVORY = "#F5F1EA";

const OUTPUT = "public/og/tara-default.png";

const photo = await sharp(from("public/images/collections/festive.webp"))
  .resize(PHOTO_WIDTH, HEIGHT, { fit: "cover", position: "attention" })
  .toBuffer();

const logo = await sharp(from("public/logo/logo-meroon.png"))
  .resize({ width: LOGO_WIDTH })
  .toBuffer();
const { height: logoHeight = 0 } = await sharp(logo).metadata();

await mkdir(path.dirname(from(OUTPUT)), { recursive: true });
await sharp({ create: { width: WIDTH, height: HEIGHT, channels: 3, background: IVORY } })
  .composite([
    { input: photo, left: WIDTH - PHOTO_WIDTH, top: 0 },
    {
      input: logo,
      left: Math.round((WIDTH - PHOTO_WIDTH - LOGO_WIDTH) / 2),
      top: Math.round((HEIGHT - logoHeight) / 2),
    },
  ])
  // Palette PNG: a flat ivory field and one photograph compress far better as
  // indexed colour, and social scrapers do not reliably fetch large images.
  .png({ compressionLevel: 9, palette: true, quality: 90 })
  .toFile(from(OUTPUT));

const meta = await sharp(from(OUTPUT)).metadata();
console.log(`${OUTPUT}  ${meta.width}x${meta.height}`);
