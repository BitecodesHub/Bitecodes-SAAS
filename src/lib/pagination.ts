/**
 * Pagination arithmetic.
 *
 * Pure and separate from the component so the window logic — which is easy to
 * get subtly wrong at the edges — can be tested directly.
 */

export interface PageWindow {
  page: number;
  totalPages: number;
  /** Page numbers to render; `null` marks an ellipsis gap. */
  items: (number | null)[];
  hasPrevious: boolean;
  hasNext: boolean;
  /** Zero-based offset for a database query. */
  skip: number;
  from: number;
  to: number;
}

/**
 * Builds a page window with a fixed visible width.
 *
 * Always includes the first and last page, and keeps the total number of
 * rendered slots constant so the control does not shift horizontally as the
 * user pages through — a jumping "next" button is easy to mis-click.
 */
export function buildPageWindow(
  page: number,
  totalItems: number,
  perPage: number,
  maxVisible = 7,
): PageWindow {
  const safePerPage = Math.max(1, Math.floor(perPage));
  const totalPages = Math.max(
    1,
    Math.ceil(Math.max(0, totalItems) / safePerPage),
  );
  const current = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);

  const skip = (current - 1) * safePerPage;
  const from = totalItems === 0 ? 0 : skip + 1;
  const to = Math.min(totalItems, skip + safePerPage);

  return {
    page: current,
    totalPages,
    items: pageItems(current, totalPages, maxVisible),
    hasPrevious: current > 1,
    hasNext: current < totalPages,
    skip,
    from,
    to,
  };
}

function pageItems(
  current: number,
  totalPages: number,
  maxVisible: number,
): (number | null)[] {
  // Five is the narrowest window that can show first, gap, current, gap, last.
  const slots = Math.max(5, Math.floor(maxVisible));

  // Fewer pages than slots: show them all, no ellipsis.
  if (totalPages <= slots) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  // Two slots always go to the first and last page. The remaining ones are
  // split between the moving window and up to two ellipses.
  const bothEllipses = slots - 4;
  const oneEllipsis = slots - 3;

  let start = current - Math.floor((bothEllipses - 1) / 2);
  let end = start + bothEllipses - 1;

  // Near the start there is no leading ellipsis, which frees exactly one slot;
  // the window widens by one rather than staying the same size, otherwise the
  // control would visibly narrow on page 1.
  if (start <= 2) {
    start = 2;
    end = start + oneEllipsis - 1;
  } else if (end >= totalPages - 1) {
    // Mirror image at the end.
    end = totalPages - 1;
    start = end - oneEllipsis + 1;
  }

  start = Math.max(2, start);
  end = Math.min(totalPages - 1, end);

  const items: (number | null)[] = [1];
  if (start > 2) items.push(null);
  for (let page = start; page <= end; page += 1) items.push(page);
  if (end < totalPages - 1) items.push(null);
  items.push(totalPages);

  return items;
}
