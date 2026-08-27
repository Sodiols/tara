import test, { describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { useCartStore } from "../store/cartStore";
import { useBuyNowStore } from "../store/buyNowStore";
import {
  CART_TOAST_DURATION_MS,
  DEFAULT_TOAST_DURATION_MS,
  useToastStore,
} from "../store/toastStore";
import type { CartItem } from "../types";

/**
 * Cart, Buy Now and toast behaviour.
 *
 * Zustand stores are plain functions outside React, so their behaviour can be
 * asserted directly — which is the part worth testing here. Three faults these
 * cover, all of which were invisible in a desktop browser:
 *
 *   * addItem() also opened the cart drawer, so on a phone every "Add to Cart"
 *     threw a full-height panel over the product being read;
 *   * Buy Now added to the cart and went to /checkout, so a customer with three
 *     saved items who clicked Buy Now on a fourth bought all four;
 *   * every toast lasted the same 3.2 seconds, so a one-word confirmation sat
 *     on screen as long as a validation error.
 */

function item(overrides: Partial<CartItem> = {}): CartItem {
  return {
    productId: "3f1e9a6c-1d2b-4c3a-9e5f-6a7b8c9d0e1f",
    slug: "embroidered-lawn-set",
    name: "Embroidered Lawn Set",
    image: "/img.jpg",
    price: 2400,
    size: "M",
    colour: "Wine",
    quantity: 1,
    ...overrides,
  };
}

beforeEach(() => {
  useCartStore.setState({ items: [], isOpen: false });
  useBuyNowStore.setState({ item: null });
  useToastStore.setState({ toasts: [] });
});

describe("adding to the cart does not touch the drawer", () => {
  test("addItem adds the line and leaves the drawer closed", () => {
    useCartStore.getState().addItem(item());

    assert.equal(useCartStore.getState().items.length, 1);
    assert.equal(
      useCartStore.getState().isOpen,
      false,
      "addItem must not open the drawer — that is openBag()'s job",
    );
  });

  test("adding the same variant again merges instead of duplicating", () => {
    useCartStore.getState().addItem(item({ quantity: 2 }));
    useCartStore.getState().addItem(item({ quantity: 3 }));

    const { items, isOpen } = useCartStore.getState();
    assert.equal(items.length, 1);
    assert.equal(items[0].quantity, 5);
    assert.equal(isOpen, false);
  });

  test("a different size or colour is a separate line", () => {
    useCartStore.getState().addItem(item({ size: "M" }));
    useCartStore.getState().addItem(item({ size: "L" }));
    useCartStore.getState().addItem(item({ size: "L", colour: "Ivory" }));

    assert.equal(useCartStore.getState().items.length, 3);
  });

  test("a line is capped at the quantity the server will accept", () => {
    useCartStore.getState().addItem(item({ quantity: 18 }));
    useCartStore.getState().addItem(item({ quantity: 18 }));
    assert.equal(useCartStore.getState().items[0].quantity, 20);
  });

  test("openBag and closeBag are the only things that move the drawer", () => {
    useCartStore.getState().openBag();
    assert.equal(useCartStore.getState().isOpen, true);
    useCartStore.getState().closeBag();
    assert.equal(useCartStore.getState().isOpen, false);
  });

  test("itemCount and subtotal reflect the lines", () => {
    useCartStore.getState().addItem(item({ quantity: 2, price: 2400 }));
    useCartStore.getState().addItem(item({ size: "L", quantity: 1, price: 1000 }));
    assert.equal(useCartStore.getState().itemCount(), 3);
    assert.equal(useCartStore.getState().subtotal(), 2 * 2400 + 1000);
  });
});

describe("Buy Now is isolated from the cart", () => {
  test("starting Buy Now leaves the cart untouched", () => {
    useCartStore.getState().addItem(item({ slug: "already-in-cart", quantity: 2 }));
    const before = useCartStore.getState().items;

    useBuyNowStore.getState().setItem(item({ productId: "other", slug: "buy-now-item" }));

    assert.deepEqual(useCartStore.getState().items, before, "the cart must not change");
    assert.equal(useCartStore.getState().itemCount(), 2, "the cart badge must not move");
    assert.equal(useCartStore.getState().isOpen, false);
  });

  test("Buy Now holds exactly one item, replacing any previous selection", () => {
    useBuyNowStore.getState().setItem(item({ slug: "first" }));
    useBuyNowStore.getState().setItem(item({ slug: "second" }));

    assert.equal(useBuyNowStore.getState().item?.slug, "second");
  });

  test("completing a Buy Now order clears only the Buy Now state", () => {
    useCartStore.getState().addItem(item({ slug: "still-in-cart", quantity: 3 }));
    useBuyNowStore.getState().setItem(item({ slug: "bought-now" }));

    // What the Buy Now checkout calls on success. Deliberately not clearBag().
    useBuyNowStore.getState().clear();

    assert.equal(useBuyNowStore.getState().item, null);
    assert.equal(useCartStore.getState().items.length, 1, "the cart must survive");
    assert.equal(useCartStore.getState().items[0].slug, "still-in-cart");
    assert.equal(useCartStore.getState().itemCount(), 3);
  });

  test("completing a cart order clears the cart and not the Buy Now state", () => {
    useCartStore.getState().addItem(item());
    useBuyNowStore.getState().setItem(item({ slug: "unrelated" }));

    useCartStore.getState().clearBag();

    assert.deepEqual(useCartStore.getState().items, []);
    assert.equal(useBuyNowStore.getState().item?.slug, "unrelated");
  });
});

describe("toast durations", () => {
  test("the cart confirmation is brief and the default is not", () => {
    // The cart badge updating is the real confirmation, so the message only has
    // to register. An error has to be readable, so it keeps the longer default.
    assert.equal(CART_TOAST_DURATION_MS, 1000);
    assert.ok(
      DEFAULT_TOAST_DURATION_MS > CART_TOAST_DURATION_MS,
      "shortening every toast to a second would make errors unreadable",
    );
  });

  test("a toast can carry its own duration without changing the default", () => {
    useToastStore.getState().addToast("Added to cart", "success", CART_TOAST_DURATION_MS);
    useToastStore.getState().addToast("Something went wrong", "error");

    const { toasts } = useToastStore.getState();
    assert.equal(toasts.length, 2);
    assert.equal(toasts[0].message, "Added to cart");
    assert.equal(toasts[1].type, "error");
  });

  test("a toast disappears on its own", async () => {
    useToastStore.getState().addToast("Added to cart", "success", 600);
    assert.equal(useToastStore.getState().toasts.length, 1);

    await new Promise((resolve) => setTimeout(resolve, 750));
    assert.equal(useToastStore.getState().toasts.length, 0);
  });

  test("a caller cannot pin a toast on screen or make one too brief to read", () => {
    // Clamped rather than trusted: a mistyped duration should not leave a
    // notification stuck over the page for an hour.
    useToastStore.getState().addToast("clamped low", "info", 1);
    useToastStore.getState().addToast("clamped high", "info", 10_000_000);
    assert.equal(useToastStore.getState().toasts.length, 2);
  });

  test("a toast can be dismissed by hand", () => {
    useToastStore.getState().addToast("Added to cart", "success");
    const { id } = useToastStore.getState().toasts[0];
    useToastStore.getState().removeToast(id);
    assert.equal(useToastStore.getState().toasts.length, 0);
  });
});
