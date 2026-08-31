import { test, expect, type Page } from "@playwright/test";

const ids = ["eid", "summer", "winter", "festive", "new-arrivals"];
const routes = ["/collection/eid", "/collection/summer", "/collection/winter", "/collection/festive", "/new-arrivals"];
const section = (page: Page) => page.locator("[data-collection-editorial]");
const stack = (page: Page) => section(page).getByRole("group", { name: "Collection photographs" });

async function openEditorial(page: Page) {
  await page.goto("/");
  await expect(section(page)).toHaveCount(1);
  await section(page).scrollIntoViewIfNeeded();
  await expect(section(page)).toHaveAttribute("data-enhanced", "true");
  await page.evaluate(() => document.fonts.ready);
  await section(page).locator("img").evaluateAll(async (images) => {
    await Promise.all(images.map((image) => (image as HTMLImageElement).decode()));
  });
}

test("five decoded prints, both directions, live metadata, real destinations and rapid input", async ({ page, request }, testInfo) => {
  const errors: string[] = [];
  const configurationWarnings: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    // lib/supabase/env.ts deliberately reports a localhost site URL in a
    // production build. Preserve that pre-existing deployment warning as test
    // evidence while still failing on every other browser error.
    if (message.text().startsWith("[config] NEXT_PUBLIC_SITE_URL")) configurationWarnings.push(message.text());
    else errors.push(message.text());
  });
  await openEditorial(page);
  await expect(section(page).locator("img")).toHaveCount(5);
  const headingBefore = await section(page).locator("h2").innerHTML();
  for (let index = 0; index < ids.length; index++) {
    await expect(section(page)).toHaveAttribute("data-active-collection", ids[index]);
    await expect(section(page).getByRole("img")).toHaveCount(1);
    await expect(section(page).getByRole("status").first()).toHaveText(
      new RegExp(`collection ${index + 1} of 5`),
    );
    const href = await section(page).getByRole("link").getAttribute("href");
    // Inactive/out-of-season collections retain the existing visibility policy.
    expect([routes[index], "/collection"]).toContain(href);
    const response = await request.get(href!);
    expect(response.status(), href!).toBe(200);
    expect(await response.text()).not.toContain("<title>Collection Not Found");
    await section(page).getByRole("button", { name: "Next collection", exact: true }).click();
    await expect(section(page)).toHaveAttribute("data-active-collection", ids[(index + 1) % 5]);
  }
  await section(page).getByRole("button", { name: "Previous collection", exact: true }).click();
  await expect(section(page)).toHaveAttribute("data-active-collection", "new-arrivals");
  await section(page).getByRole("button", { name: "Next collection", exact: true }).click();
  await expect(section(page)).toHaveAttribute("data-active-collection", "eid");
  // A burst during a turn must not race, skip cards or disagree with metadata.
  await section(page).getByRole("button", { name: "Next collection", exact: true }).evaluate((button) => {
    for (let n = 0; n < 12; n++) (button as HTMLButtonElement).click();
  });
  await expect(section(page)).toHaveAttribute("data-active-collection", "summer");
  await expect(stack(page)).toHaveAttribute("aria-busy", "false");
  expect(await section(page).locator("h2").innerHTML()).toBe(headingBefore);
  if (configurationWarnings.length) {
    await testInfo.attach("existing-site-url-configuration-warning", {
      body: configurationWarnings.join("\n"),
      contentType: "text/plain",
    });
  }
  expect(errors).toEqual([]);
});

test("all requested widths preserve 30% overlap, image geometry and visible content", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Viewport matrix uses the desktop browser; mobile gestures run separately.");
  await openEditorial(page);
  for (const width of [1920, 1600, 1440, 1366, 1280, 1024, 900, 820, 768, 480, 430, 412, 390, 375, 360, 320]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1080 });
    await section(page).scrollIntoViewIfNeeded();
    await section(page).locator("img").evaluateAll(async (images) => {
      await Promise.all(images.map((image) => (image as HTMLImageElement).decode()));
    });
    const measurements = await section(page).evaluate((root) => {
      const card = root.querySelector('[data-current="true"]')!.getBoundingClientRect();
      const image = root.querySelector('[data-current="true"] img')!.getBoundingClientRect();
      const words = [...root.querySelectorAll("h2 span")].map((word) => {
        const bounds = word.getBoundingClientRect();
        return {
          overlap: (Math.min(bounds.right, card.right) - Math.max(bounds.left, card.left)) / bounds.width,
          left: bounds.left, right: bounds.right,
          top: bounds.top, bottom: bounds.bottom,
          cardTop: card.top, cardBottom: card.bottom,
          z: Number(getComputedStyle(word).zIndex),
        };
      });
      return {
        words, cardZ: Number(getComputedStyle(root.querySelector('[data-current="true"]')!).zIndex),
        aspect: image.width / image.height,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        font: getComputedStyle(root.querySelector("h2 span")!).fontFamily,
      };
    });
    expect(measurements.overflow, `${width}px page overflow`).toBeLessThanOrEqual(0);
    expect(measurements.aspect).toBeCloseTo(0.8, 2);
    expect(measurements.font).toContain("Bodoni");
    for (const word of measurements.words) {
      expect(word.overlap, `${width}px overlap`).toBeGreaterThan(0.28);
      expect(word.overlap, `${width}px overlap`).toBeLessThan(0.32);
      expect(word.left).toBeGreaterThanOrEqual(0);
      expect(word.right).toBeLessThanOrEqual(width);
      expect(word.top).toBeGreaterThan(word.cardTop);
      expect(word.bottom).toBeLessThan(word.cardBottom);
      expect(word.z).toBeGreaterThan(measurements.cardZ);
    }
    await section(page).screenshot({ path: testInfo.outputPath(`editorial-${width}.png`) });
  }
});

test("keyboard and reduced motion keep the stack fully usable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openEditorial(page);
  await stack(page).focus();
  await page.keyboard.press("ArrowRight");
  await expect(section(page)).toHaveAttribute("data-active-collection", "summer");
  await expect(stack(page)).toBeFocused();
  const reduced = await section(page).evaluate((root) => ({
    transforms: [...root.querySelectorAll("[data-current]")].map((card) => getComputedStyle(card).transform),
    animations: root.getAnimations({ subtree: true }).length,
  }));
  expect(reduced.transforms.every((transform) => transform === "none")).toBe(true);
  expect(reduced.animations).toBe(0);
  await page.keyboard.press("ArrowLeft");
  await expect(section(page)).toHaveAttribute("data-active-collection", "eid");
  await section(page).getByRole("button", { name: "Previous collection", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(section(page)).toHaveAttribute("data-active-collection", "new-arrivals");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Space");
  await expect(section(page)).toHaveAttribute("data-active-collection", "eid");
});

test("touch swipes work in both directions without stealing vertical scrolling", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Requires touch emulation.");
  await openEditorial(page);
  const session = await context.newCDPSession(page);
  const gesture = async (dx: number, dy: number) => {
    const rect = await stack(page).boundingBox();
    expect(rect).not.toBeNull();
    const x = rect!.x + rect!.width / 2;
    const y = rect!.y + rect!.height / 2;
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    for (let step = 1; step <= 10; step++) {
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove", touchPoints: [{ x: x + dx * step / 10, y: y + dy * step / 10 }],
      });
    }
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };
  await gesture(-90, 4);
  await expect(section(page)).toHaveAttribute("data-active-collection", "summer");
  await gesture(90, 4);
  await expect(section(page)).toHaveAttribute("data-active-collection", "eid");
  const yBefore = await page.evaluate(() => window.scrollY);
  await gesture(4, -120);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(yBefore + 30);
  await expect(section(page)).toHaveAttribute("data-active-collection", "eid");
  await session.detach();
});

test("desktop dragging changes only the print and leaves a normal vertical gesture alone", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Mouse interaction only.");
  await openEditorial(page);
  const rect = await stack(page).boundingBox();
  const x = rect!.x + rect!.width / 2;
  const y = rect!.y + rect!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 100, y + 3, { steps: 10 });
  await page.mouse.up();
  await expect(section(page)).toHaveAttribute("data-active-collection", "summer");
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 3, y + 100, { steps: 10 });
  await page.mouse.up();
  await expect(section(page)).toHaveAttribute("data-active-collection", "summer");
});

test("no JavaScript still shows the first photograph, heading, copy and a real link", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(test.info().project.use.baseURL ?? "http://localhost:3000");
  await section(page).scrollIntoViewIfNeeded();
  await expect(section(page).getByRole("heading", { name: "Everyday Elegance" })).toBeVisible();
  await expect(section(page).getByRole("img")).toHaveCount(1);
  await expect(section(page).getByRole("link")).toBeVisible();
  await expect(section(page).getByText("Thoughtfully selected pieces", { exact: false })).toBeVisible();
  await expect(section(page).getByRole("button", { name: "Next collection", exact: true })).toBeHidden();
  await expect.poll(() => section(page).getByRole("img").evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await context.close();
});

// Read-only fault injection: neither test writes to the catalogue or requires credentials.
test("a delayed upcoming image keeps the current print visible until decode", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/_next/image?**", async (route) => {
    if (route.request().url().includes("summer")) await gate;
    await route.continue();
  });
  await page.goto("/");
  await section(page).scrollIntoViewIfNeeded();
  await expect(section(page)).toHaveAttribute("data-enhanced", "true");
  await section(page).locator('[data-current="true"] img').evaluate((image) => (image as HTMLImageElement).decode());
  await section(page).getByRole("button", { name: "Next collection", exact: true }).click();
  await expect(stack(page)).toHaveAttribute("aria-busy", "true");
  await expect(section(page)).toHaveAttribute("data-active-collection", "eid");
  expect(await section(page).locator('[data-current="true"]').evaluate((card) => getComputedStyle(card).opacity)).toBe("1");
  release();
  await expect(section(page)).toHaveAttribute("data-active-collection", "summer");
});

test("a failed image retains the current print and other navigation remains available", async ({ page }) => {
  await page.route("**/_next/image?**", async (route) => {
    if (route.request().url().includes("summer")) await route.abort("failed");
    else await route.continue();
  });
  await page.goto("/");
  await section(page).scrollIntoViewIfNeeded();
  await expect(section(page)).toHaveAttribute("data-enhanced", "true");
  await section(page).locator('[data-current="true"] img').evaluate((image) => (image as HTMLImageElement).decode());
  await section(page).getByRole("button", { name: "Next collection", exact: true }).click();
  await expect(section(page).getByRole("status").last()).toContainText("photograph couldn’t load");
  await expect(section(page)).toHaveAttribute("data-active-collection", "eid");
  await expect(stack(page)).toHaveAttribute("aria-busy", "false");
  await section(page).getByRole("button", { name: "Previous collection", exact: true }).click();
  await expect(section(page)).toHaveAttribute("data-active-collection", "new-arrivals");
});

test("scrolling and elapsed time do not advance the collection", async ({ page }) => {
  await openEditorial(page);
  await page.clock.install();
  await page.clock.fastForward(15_000);
  await page.mouse.wheel(0, 400);
  await page.clock.fastForward(5_000);
  await expect(section(page)).toHaveAttribute("data-active-collection", "eid");
});
