import { describe, expect, it } from "vitest";
import { buildPageWindow } from "@/lib/pagination";

describe("buildPageWindow", () => {
  it("computes offsets and the displayed range", () => {
    const window = buildPageWindow(2, 95, 20);
    expect(window.skip).toBe(20);
    expect(window.from).toBe(21);
    expect(window.to).toBe(40);
    expect(window.totalPages).toBe(5);
  });

  it("caps the range on the last, partial page", () => {
    const window = buildPageWindow(5, 95, 20);
    expect(window.from).toBe(81);
    expect(window.to).toBe(95);
    expect(window.hasNext).toBe(false);
  });

  it("handles an empty result set without showing 'from 1'", () => {
    const window = buildPageWindow(1, 0, 20);
    expect(window.totalPages).toBe(1);
    expect(window.from).toBe(0);
    expect(window.to).toBe(0);
    expect(window.items).toEqual([1]);
    expect(window.hasPrevious).toBe(false);
    expect(window.hasNext).toBe(false);
  });

  it("clamps a page number beyond the end", () => {
    // A stale bookmark or hand-edited URL must not produce a negative skip.
    const window = buildPageWindow(999, 50, 20);
    expect(window.page).toBe(3);
    expect(window.skip).toBe(40);
  });

  it("clamps zero, negative, and non-numeric pages to 1", () => {
    for (const page of [0, -5, Number.NaN]) {
      const window = buildPageWindow(page, 50, 20);
      expect(window.page, String(page)).toBe(1);
      expect(window.skip).toBe(0);
    }
  });

  it("guards against a zero or negative page size", () => {
    // Would otherwise divide by zero and produce Infinity pages.
    for (const perPage of [0, -10]) {
      const window = buildPageWindow(1, 50, perPage);
      expect(Number.isFinite(window.totalPages), String(perPage)).toBe(true);
      expect(window.totalPages).toBe(50);
    }
  });

  it("shows every page when they fit", () => {
    expect(buildPageWindow(1, 100, 20, 7).items).toEqual([1, 2, 3, 4, 5]);
    expect(buildPageWindow(4, 140, 20, 7).items).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("adds a trailing ellipsis near the start", () => {
    const items = buildPageWindow(2, 400, 20, 7).items;
    expect(items[0]).toBe(1);
    expect(items.at(-1)).toBe(20);
    expect(items).toContain(null);
    expect(items.indexOf(null)).toBeGreaterThan(3);
  });

  it("adds a leading ellipsis near the end", () => {
    const items = buildPageWindow(19, 400, 20, 7).items;
    expect(items[0]).toBe(1);
    expect(items[1]).toBeNull();
    expect(items.at(-1)).toBe(20);
  });

  it("adds ellipses on both sides in the middle", () => {
    const items = buildPageWindow(10, 400, 20, 7).items;
    expect(items[0]).toBe(1);
    expect(items[1]).toBeNull();
    expect(items.at(-2)).toBeNull();
    expect(items.at(-1)).toBe(20);
    expect(items).toContain(10);
  });

  it("keeps a constant number of slots so the control does not shift", () => {
    // A control that changes width as you page through is easy to mis-click.
    for (const maxVisible of [5, 6, 7, 8, 9]) {
      const widths = new Set(
        [1, 2, 3, 5, 10, 15, 18, 19, 20].map(
          (page) => buildPageWindow(page, 400, 20, maxVisible).items.length,
        ),
      );
      expect(widths.size, `maxVisible=${maxVisible}`).toBe(1);
      expect([...widths][0], `maxVisible=${maxVisible}`).toBe(maxVisible);
    }
  });

  it("always includes the current page in the window", () => {
    for (const maxVisible of [5, 7, 9]) {
      for (let page = 1; page <= 20; page += 1) {
        const window = buildPageWindow(page, 400, 20, maxVisible);
        expect(window.items, `page ${page}/${maxVisible}`).toContain(page);
      }
    }
  });

  it("never emits a duplicate or out-of-range page", () => {
    for (const total of [1, 5, 20, 100, 401]) {
      for (const page of [1, 2, 3, 7, 50, 99]) {
        const window = buildPageWindow(page, total * 20, 20, 7);
        const numbers = window.items.filter(
          (item): item is number => item !== null,
        );
        expect(new Set(numbers).size, `${total}/${page}`).toBe(numbers.length);
        for (const number of numbers) {
          expect(number).toBeGreaterThanOrEqual(1);
          expect(number).toBeLessThanOrEqual(window.totalPages);
        }
        // Ascending order.
        expect([...numbers].sort((a, b) => a - b)).toEqual(numbers);
      }
    }
  });

  it("never places two ellipses next to each other", () => {
    for (const page of [1, 2, 3, 4, 10, 17, 18, 19, 20]) {
      const items = buildPageWindow(page, 400, 20, 7).items;
      for (let index = 1; index < items.length; index += 1) {
        expect(
          items[index] === null && items[index - 1] === null,
          `page ${page}`,
        ).toBe(false);
      }
    }
  });
});
