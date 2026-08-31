# Collections editorial

The existing `FeaturedBanner` is replaced in place; `app/page.tsx`, the logo, global styles, commerce, auth and Find Your Look are unchanged.

## Layout and interaction

Bodoni Moda and Manrope use the existing next/font variables. All colours use TARA's existing CSS tokens. The unpadded max-content word boxes are anchored to opposite card edges with -70% and -30% translations, giving approximately 30% overlap independently of viewport width or font loading. On phones the portrait uses 48% of the content width: a larger portrait and complete large words cannot simultaneously fit the requested 70% outside overlap within the viewport. This prioritizes the explicit overlap and no-clipping requirements over the suggested mobile card width.

Native Web Animations move the outgoing print left with a restrained rotation; Previous brings the previous print back along the same path. Five image nodes stay mounted. An immediate lock prevents rapid input races. Pointer events distinguish horizontal from vertical movement; CSS allows pan-y and pinch zoom. Buttons and arrow keys provide alternatives. Reduced motion removes rotations and movement. There is no scroll-linked card movement or scroll locking.

Automatic browsing advances every 1,000ms while at least half of the photograph is visible and the browser tab is active. The interval is measured from one transition start to the next, not after the 580ms animation finishes. Manual navigation or a pointer gesture delays automatic browsing for five idle seconds. Keyboard focus, dragging, and hovering a collection link or navigation control suspend new automatic transitions. A manual click during an automatic transition is applied once the print settles.

The small Pause/Play control stops or resumes automatic browsing. Reduced-motion visitors start with autoplay paused; explicit Play advances without card movement. Automatic changes do not repeatedly announce themselves to screen readers; manual changes still do. Slow image decoding never overlaps transitions, and an image failure pauses automatic browsing rather than repeatedly retrying a failed request.

The next responsive image must decode before movement starts. An eight-second wait limit leaves the current print visible and announces a loading failure. The user can browse in the other direction or reload to retry a failed request. Images warm near the viewport and have static-import blur placeholders; nothing in this section is preloaded ahead of the homepage hero. First image, heading, description and real CTA are server rendered without JavaScript; enhancement-only controls are hidden.

## Verification

Validated on 2026-08-31 with the local development server and the production build:

- `npm run lint`, `npm run typecheck`, `npm run build`, and `git diff --check`.
- `npm test`: 276 existing unit tests pass.
- `npx playwright test e2e/collection-editorial.spec.ts --reporter=list`: 25 passing cases across Chromium desktop and Pixel 7 emulation. Three intentional skips avoid running mouse-only, touch-only, or viewport-matrix cases in the wrong profile.
- Widths: 1920, 1600, 1440, 1366, 1280, 1024, 900, 820, 768, 480, 430, 412, 390, 375, 360 and 320 pixels. Both words measure approximately 30% overlap, remain above the photo, and fit without horizontal page overflow. Image ratio stays 4:5.
- All five current CTA destinations return 200. Next/Previous wrap, repeated clicks stay consistent, arrow keys/Enter/Space work, and native emulated touch swipes preserve vertical scrolling.
- No-JavaScript content and decoded first image remain useful. Reduced motion defaults to manual browsing and removes movement. Paused playback stays paused across scrolling and elapsed time.
- Autoplay timing, five-collection wrapping, pause/resume, the manual idle delay, keyboard focus, viewport visibility, and explicit motion-free playback are checked in the browser.
- Delayed and failed image requests are tested without replacing the current print with a blank image.
- A scoped axe-core WCAG A/AA scan reports no violations. No feature errors or missing collection images were observed.

The existing local `NEXT_PUBLIC_SITE_URL=http://localhost:3000` setting emits a warning in the production build and browser through `lib/supabase/env.ts`. The app falls back to its existing production domain. The browser test preserves this known warning as an attachment and fails on other errors. Set the correct public site URL on the deployment host; this task does not modify environment or authentication settings.

These are read-only storefront checks, not authenticated admin, checkout purchase, database integration, physical-device or deployment verification. No database records were changed.

To repeat against an already running production build in PowerShell:

```powershell
$env:E2E_BASE_URL = 'http://127.0.0.1:3100'
npx playwright test e2e/collection-editorial.spec.ts --reporter=list
```

## Routing

Canonical routes match the collection menu: /collection/eid, /collection/summer, /collection/winter, /collection/festive and /new-arrivals. The server uses the existing cached getVisibleCollections query. An unavailable seasonal edit links to /collection with the honest label “Explore collections”; its closed route is never bypassed.

## Image provenance

Five editorial illustrations generated using the built-in imagegen tool, not photographs of verified inventory. They are collection mood imagery, not product listing photos. No product records or product images were changed. The original generated files remain outside the repo; the five optimized 1120 × 1400 WebP assets live in public/images/collections. Combined source size is approximately 479 KiB; next/image delivers smaller responsive AVIF/WebP renditions.

Prompt set used (one built-in generation per asset):

### eid

Use case: photorealistic-natural. Asset: a single portrait fashion photograph, 4:5 aspect ratio, for the Bangladeshi womenswear brand TARA's editorial collections, NO text, NO logo, NO watermark, NO collage. A refined, realistic South Asian adult female model in modest Bangladeshi three-piece fashion, photographed from head to lower calf, natural anatomy and skin, clothes are the hero. Art direction across a coordinated campaign: warm limestone courtyard, quiet pale plaster wall, soft directional daylight from the left, subtle analogue photographic texture, restrained contrast, rich natural fabrics, no props or excessive jewelry. Central model taking about 55% frame width, generous uncluttered space on both sides, head within upper quarter but with breathing room above. Elegant calm fashion editorial, premium magazine photography, honest tactile fabric, no plastic skin. Eid: ivory embroidered kameez with delicate tonal embroidery, flowing matching trousers, sheer ivory dupatta edged in tiny dull gold detail. Graceful standing posture, hands relaxed and anatomically natural, warm off-white plaster background. Celebratory and refined.

### summer

Use case: photorealistic-natural. Asset: a single portrait fashion photograph, 4:5 aspect ratio, for the Bangladeshi womenswear brand TARA's editorial collections, NO text, NO logo, NO watermark, NO collage. A refined, realistic South Asian adult female model in modest Bangladeshi three-piece fashion, photographed from head to lower calf, natural anatomy and skin, clothes are the hero. Art direction across a coordinated campaign: warm limestone courtyard, quiet pale plaster wall, soft directional daylight from the left, subtle analogue photographic texture, restrained contrast, rich natural fabrics, no props or excessive jewelry. Central model taking about 55% frame width, generous uncluttered space on both sides, head within upper quarter but with breathing room above. Elegant calm fashion editorial, premium magazine photography, honest tactile fabric, no plastic skin. Summer: pale sage airy cotton kameez with subtle fine botanical block print, matching trousers and a lightweight pale dupatta loosely draped from one shoulder. Fresh bright daylight, easy natural posture by the pale courtyard wall, summer calm.

### winter

Use case: photorealistic-natural. Asset: a single portrait fashion photograph, 4:5 aspect ratio, for the Bangladeshi womenswear brand TARA's editorial collections, NO text, NO logo, NO watermark, NO collage. A refined, realistic South Asian adult female model in modest Bangladeshi three-piece fashion, photographed from head to lower calf, natural anatomy and skin, clothes are the hero. Art direction across a coordinated campaign: warm limestone courtyard, quiet pale plaster wall, soft directional daylight from the left, subtle analogue photographic texture, restrained contrast, rich natural fabrics, no props or excessive jewelry. Central model taking about 55% frame width, generous uncluttered space on both sides, head within upper quarter but with breathing room above. Elegant calm fashion editorial, premium magazine photography, honest tactile fabric, no plastic skin. Winter: muted cocoa taupe textured long kameez, matching trousers, and a softly draped warm oatmeal woven shawl with a discreet embroidered border. Soft warm winter afternoon light against limestone plaster. No western coats. Layered but lightweight South Asian winter styling.

### festive

Use case: photorealistic-natural. Asset: a single portrait fashion photograph, 4:5 aspect ratio, for the Bangladeshi womenswear brand TARA's editorial collections, NO text, NO logo, NO watermark, NO collage. A refined, realistic South Asian adult female model in modest Bangladeshi three-piece fashion, photographed from head to lower calf, natural anatomy and skin, clothes are the hero. Art direction across a coordinated campaign: warm limestone courtyard, quiet pale plaster wall, soft directional daylight from the left, subtle analogue photographic texture, restrained contrast, rich natural fabrics, no props or excessive jewelry. Central model taking about 55% frame width, generous uncluttered space on both sides, head within upper quarter but with breathing room above. Elegant calm fashion editorial, premium magazine photography, honest tactile fabric, no plastic skin. Festive: deep wine burgundy long kameez, flowing trousers, a sheer wine dupatta, refined sparse antique gold embroidery around the neckline and cuffs. Celebration fashion with tasteful intricate textile detail, simple elegant natural pose, pale warm limestone wall.

### new-arrivals

Use case: photorealistic-natural. Asset: a single portrait fashion photograph, 4:5 aspect ratio, for the Bangladeshi womenswear brand TARA's editorial collections, NO text, NO logo, NO watermark, NO collage. A refined, realistic South Asian adult female model in modest Bangladeshi three-piece fashion, photographed from head to lower calf, natural anatomy and skin, clothes are the hero. Art direction across a coordinated campaign: warm limestone courtyard, quiet pale plaster wall, soft directional daylight from the left, subtle analogue photographic texture, restrained contrast, rich natural fabrics, no props or excessive jewelry. Central model taking about 55% frame width, generous uncluttered space on both sides, head within upper quarter but with breathing room above. Elegant calm fashion editorial, premium magazine photography, honest tactile fabric, no plastic skin. New arrivals: dusty rose pink contemporary long kameez with clean architectural tailoring and understated tonal embroidery, straight matching trousers, softly draped rose dupatta. Modern editorial posture, calm expression. Bright warm plaster courtyard backdrop.
