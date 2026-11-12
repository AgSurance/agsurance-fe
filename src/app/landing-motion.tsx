"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";

export function PaymentGate() {
  const figure = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const target = figure.current;
    if (!target || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setSeen(true);
      observer.disconnect();
    }, { threshold: 0.4 });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <figure className="payment-gate" ref={figure} data-seen={seen ? "" : undefined}>
      <Image
        src="/payment-gate.webp"
        alt="A metal gate with an open lane and a second lane closed by a pink stop plate."
        width={1200}
        height={800}
        sizes="(max-width: 760px) 92vw, 44vw"
      />
      <figcaption className="gate-outcomes">
        <div className="gate-route gate-allowed">
          <span>Approved supplier</span>
          <span className="gate-track" aria-hidden="true"><i /></span>
          <strong>Allowed</strong>
        </div>
        <div className="gate-route gate-blocked">
          <span>Outside the mandate</span>
          <span className="gate-track" aria-hidden="true"><i /></span>
          <strong>Blocked</strong>
        </div>
      </figcaption>
    </figure>
  );
}

export function ClaimDiagram({ children }: { children: ReactNode }) {
  const [playback, setPlayback] = useState(0);

  return (
    <>
      <div className="claim-diagram-actions">
        <button type="button" aria-controls="claim-role-diagram" onClick={() => setPlayback((run) => run + 1)}>
          {playback ? "Replay claim" : "Follow a claim"}
        </button>
        <p role="status">
          {playback > 0 && "Claim path highlighted from agent to reviewers, claims reserve and recovery account."}
        </p>
      </div>
      <div key={playback} id="claim-role-diagram" className="role-diagram" data-claim-active={playback ? "" : undefined}>
        {children}
      </div>
    </>
  );
}
