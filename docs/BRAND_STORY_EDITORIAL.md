# Static brand-story editorial

The existing `BrandStorySection` is redesigned in place. The homepage still renders it once in the same position. No other homepage section, global style, navigation, logo, route, authentication, commerce, or Supabase code is changed.

## Composition

- Existing Bodoni Moda and Manrope font variables and TARA palette tokens; Soft Ivory background, black headline, and Deep Wine only on the word “story.”
- The original `stockImages.lifestyleA` portrait is retained, with a 4:5 source crop and responsive `next/image` sizing. This is existing stock imagery, not a new photograph of verified TARA inventory.
- Desktop portrait occupies 42% of the inner composition; tablet uses 44%. The headline sits directly below and left-aligned with “About TARA” in the right-hand text column, with no photograph overlap.
- On mobile “About TARA” and the headline appear together above the portrait. The portrait occupies 82% of the inner composition, with the location caption vertically beside it.
- The large decorative TARA word uses Bodoni Moda at 5.5% wine opacity, reduced to 4.5% on mobile. It is excluded from the accessibility tree.
- Original brand copy is preserved, with a maximum paragraph width of 460px. The real `/about` link is labeled “Discover TARA,” underlined, and has a 44px hit area and visible keyboard focus.
- No section animation, transition, event handler, timer, scroll listener, carousel, sticky positioning, or client component is introduced. The heading uses normal grid placement without a transform.

The desktop section is approximately 750–795px tall at widths of 1280px and above. Height is content-driven, not fixed.

## Verification

Validated against the production build on 2026-08-31:

- `npm run lint`, `npm run typecheck`, `npm run build`, and `git diff --check` pass.
- `e2e/brand-story.spec.ts`: nine passing browser cases across Chromium desktop and Pixel 7 emulation. One intentional skip avoids repeating the sixteen-width matrix in the mobile profile.
- Verified 1920, 1600, 1440, 1366, 1280, 1024, 900, 820, 768, 480, 430, 412, 390, 375, 360, and 320px. No horizontal overflow or clipped text; two-line heading, 4:5 image, label-to-heading alignment, and loaded Bodoni Moda remain consistent.
- The headline remains separate from the portrait at every breakpoint.
- Hover, elapsed time, scrolling, and keyboard focus do not move the composition. No CSS animations or active Web Animations are present in the section.
- Copy, image, heading, and About navigation work without JavaScript. `/about` returns 200 and both client and ordinary anchor navigation work.
- Holding back the image request does not shift its reserved frame, headline, copy, link, or caption.
- Before the headline-alignment adjustment, additional desktop, tablet, and mobile audits observed no section layout shifts, and scoped axe-core WCAG A/AA scans at 1440, 768, and 320px reported no violations. The only manual contrast-review item was the intentionally faint, decorative, `aria-hidden` TARA word; it conveys no essential content. These extra audits have not been repeated for the alignment-only adjustment.

The existing local `NEXT_PUBLIC_SITE_URL=http://localhost:3000` emits its existing production configuration warning; the app falls back to `https://www.tarabd.co`. The browser test records that warning separately and fails on other console errors. This change does not edit environment settings. Production deployment, authenticated admin, purchase flows, and live database writes are outside this section's verification.

To repeat against a running local production server:

```powershell
$env:E2E_BASE_URL = 'http://127.0.0.1:3100'
npx playwright test e2e/brand-story.spec.ts --reporter=list
```

Current alignment screenshots are in the ignored `tmp/brand-story-alignment/` directory at 1440, 1024, 768, 390, and 320px. Original design screenshots and the earlier accessibility audit remain in `tmp/brand-story/`. No generated test images are committed.
