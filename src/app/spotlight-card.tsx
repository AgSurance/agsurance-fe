"use client";

import type { MouseEvent, ReactNode } from "react";

// Adapted from React Bits SpotlightCard (David Haz); see licenses/react-bits.md.
export function SpotlightCard({ children }: { children: ReactNode }) {
  function moveSpotlight(event: MouseEvent<HTMLElement>) {
    const card = event.currentTarget;
    const rect = card.getBoundingClientRect();
    card.style.setProperty("--spotlight-x", `${event.clientX - rect.left}px`);
    card.style.setProperty("--spotlight-y", `${event.clientY - rect.top}px`);
  }

  return (
    <article className="feature spotlight-card" onMouseMove={moveSpotlight}>
      {children}
    </article>
  );
}
