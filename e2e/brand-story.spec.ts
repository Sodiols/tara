import { test, expect, type Page } from "@playwright/test";

const widths = [1920, 1600, 1440, 1366, 1280, 1024, 900, 820, 768, 480, 430, 412, 390, 375, 360, 320];
const story = (page: Page) => page.locator("[data-brand-story]");

async function positionStory(page: Page) {
  // Leave room for the site's existing sticky navigation in visual evidence.
  await story(page).evaluate((root) => window.scrollTo({
    top: root.getBoundingClientRect().top + window.scrollY - 96,
    behavior: "instant",
  }));
  await page.evaluate(() => document.fonts.ready);
}

async function openStory(page: Page) {
  await page.goto("/");
  await expect(story(page)).toHaveCount(1);
  await positionStory(page);
  await story(page).getByRole("img").evaluate((image) => (image as HTMLImageElement).decode());
}

async function compositionSnapshot(page: Page) {
  return story(page).evaluate((root) => {
    const origin = root.getBoundingClientRect();
    return Array.from(root.querySelectorAll("img, h2, p, a, figcaption"), (element) => {
      const rect = element.getBoundingClientRect();
      return [rect.x - origin.x, rect.y - origin.y, rect.width, rect.height].map((value) => Math.round(value * 100) / 100);
    });
  });
}

test("one editorial story preserves the copy, semantic text and working About route", async ({ page, request }, testInfo) => {
  const errors: string[] = [];
  const configWarnings: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (text.startsWith("[config] NEXT_PUBLIC_SITE_URL") && text.includes("localhost:3000")) configWarnings.push(text);
    else errors.push(text);
  });
  await openStory(page);
  await expect(story(page).getByRole("heading", { level: 2 })).toHaveText("Designed for your everyday story");
  await expect(story(page).getByText("TARA brings together comfort, modern style, and thoughtful details for women across Bangladesh. Every collection is selected to help you feel confident, comfortable, and beautifully yourself.", { exact: true })).toBeVisible();
  await expect(story(page).getByRole("img")).toHaveCount(1);
  await expect(story(page).getByRole("img")).toHaveAttribute("alt", /woman in a mauve draped outfit/);
  await expect(story(page).locator('span[aria-hidden="true"]')).toHaveText("TARA");
  const link = story(page).getByRole("link", { name: "Discover TARA" });
  await expect(link).toHaveAttribute("href", "/about");
  expect((await request.get("/about")).status()).toBe(200);
  await link.click();
  await expect(page).toHaveURL(/\/about$/);
  expect(errors).toEqual([]);
  if (configWarnings.length) {
    await testInfo.attach("existing-site-url-warning", { body: configWarnings.join("\n"), contentType: "text/plain" });
  }
});

test("all sixteen widths keep the portrait, controlled overlap and typography within the viewport", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "The viewport matrix runs once; mobile behavior has its own profile.");
  await page.setViewportSize({ width: 1440, height: 1100 });
  await openStory(page);
  for (const width of widths) {
    await page.setViewportSize({ width, height: 1100 });
    await positionStory(page);
    await story(page).getByRole("img").evaluate((image) => (image as HTMLImageElement).decode());
    const layout = await story(page).evaluate((root) => {
      const image = root.querySelector("img")!.getBoundingClientRect();
      const heading = root.querySelector("h2")!.getBoundingClientRect();
      const canvas = root.firstElementChild!.firstElementChild!.getBoundingClientRect();
      const text = Array.from(root.querySelectorAll("h2 > span, p, a, figcaption, span[aria-hidden]"), (element) => {
        const rect = element.getBoundingClientRect();
        return { text: element.textContent, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      });
      const headingStyle = getComputedStyle(root.querySelector("h2")!);
      return {
        imageRatio: image.width / image.height,
        imageFraction: image.width / canvas.width,
        sideOverlap: (image.right - heading.left) / heading.width,
        lowerOverlap: (image.bottom - heading.top) / heading.height,
        sectionHeight: root.getBoundingClientRect().height,
        overflow: document.documentElement.scrollWidth - innerWidth,
        text,
        font: headingStyle.fontFamily.toLowerCase(),
        fontLoaded: document.fonts.check(`${headingStyle.fontSize} ${headingStyle.fontFamily.split(",")[0]}`),
      };
    });
    expect(layout.overflow, `${width}px page overflow`).toBe(0);
    expect(layout.imageRatio).toBeCloseTo(0.8, 2);
    expect(layout.font).toContain("bodoni");
    expect(layout.fontLoaded).toBe(true);
    for (const box of layout.text) {
      expect(box.left, `${width}px: ${box.text}`).toBeGreaterThanOrEqual(0);
      expect(box.right, `${width}px: ${box.text}`).toBeLessThanOrEqual(width);
    }
    if (width >= 768) {
      expect(layout.sideOverlap).toBeCloseTo(width >= 1024 ? 0.12 : 0.1, 2);
      expect(layout.imageFraction).toBeCloseTo(width >= 1024 ? 0.42 : 0.44, 2);
    } else {
      expect(layout.imageFraction).toBeCloseTo(0.82, 2);
      expect(layout.lowerOverlap).toBeGreaterThan(0.1);
      expect(layout.lowerOverlap).toBeLessThan(0.16);
    }
    if (width >= 1280) {
      expect(layout.sectionHeight).toBeGreaterThanOrEqual(650);
      expect(layout.sectionHeight).toBeLessThanOrEqual(800);
    }
    await testInfo.attach(`brand-story-${width}px`, { body: await story(page).screenshot(), contentType: "image/png" });
  }
});

test("time, hover, scrolling and keyboard focus never move the composition", async ({ page }) => {
  await openStory(page);
  const animatedElements = await story(page).evaluate((root) =>
    [root, ...root.querySelectorAll("*")]
      .filter((element) => getComputedStyle(element).animationName !== "none")
      .map((element) => element.tagName),
  );
  expect(animatedElements).toEqual([]);
  const before = await compositionSnapshot(page);
  const source = await story(page).getByRole("img").getAttribute("src");
  await story(page).getByRole("img").hover();
  await story(page).getByRole("link").hover();
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(2500);
  expect(await compositionSnapshot(page)).toEqual(before);
  await expect(story(page).getByRole("img")).toHaveAttribute("src", source!);
  expect(await story(page).evaluate((root) => root.getAnimations({ subtree: true }).length)).toBe(0);
  const link = story(page).getByRole("link");
  await link.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(link).toBeFocused();
  const focus = await link.evaluate((element) => ({
    visible: element.matches(":focus-visible"),
    outline: getComputedStyle(element).outlineStyle,
  }));
  expect(focus).toEqual({ visible: true, outline: "solid" });
  expect(await compositionSnapshot(page)).toEqual(before);
});

test("the complete editorial remains available without JavaScript", async ({ browser }, testInfo) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 1000 }, baseURL: testInfo.project.use.baseURL });
  const page = await context.newPage();
  await openStory(page);
  await expect(story(page).getByRole("heading", { name: "Designed for your everyday story" })).toBeVisible();
  await expect(story(page).getByRole("img")).toBeVisible();
  await story(page).getByRole("link", { name: "Discover TARA" }).click();
  await expect(page).toHaveURL(/\/about$/);
  await context.close();
});

test("a delayed portrait cannot shift the headline, story or reserved image frame", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/_next/image?**", async (route) => {
    if (route.request().url().includes("1769031364744-9fecc63d93cd")) await gate;
    await route.continue();
  });
  try {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await positionStory(page);
    expect(await story(page).getByRole("img").evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBe(0);
    const before = await compositionSnapshot(page);
    release();
    await story(page).getByRole("img").evaluate((image) => (image as HTMLImageElement).decode());
    expect(await compositionSnapshot(page)).toEqual(before);
  } finally {
    release();
  }
});
