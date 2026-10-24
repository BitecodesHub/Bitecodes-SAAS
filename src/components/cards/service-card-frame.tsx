"use client";

import Link from "next/link";
import type { PointerEvent, ReactNode } from "react";

function trackPointer(event: PointerEvent<HTMLAnchorElement>) {
  if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
  const rect = event.currentTarget.getBoundingClientRect();
  event.currentTarget.style.setProperty(
    "--card-x",
    `${event.clientX - rect.left}px`,
  );
  event.currentTarget.style.setProperty(
    "--card-y",
    `${event.clientY - rect.top}px`,
  );
}

/**
 * Keeps the card's contents server-rendered while letting the light follow
 * the pointer. Only this wrapper ships to the browser.
 */
export function ServiceCardFrame({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} onPointerMove={trackPointer} className={className}>
      {children}
    </Link>
  );
}
