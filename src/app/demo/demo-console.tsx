"use client";

import { useEffect, useState } from "react";
import type { Activity, DemoState, Step } from "../../lib/demo-state";

const explorer = "https://testnet.nearblocks.io/txns/";
const historyKey = "agsurance-testnet-activity";
const near = (value: string) => `${Number(BigInt(value) / (BigInt(10) ** BigInt(21))) / 1000} NEAR`;

export function DemoConsole() {
  const [state, setState] = useState<DemoState>();
  const [history, setHistory] = useState<Activity[]>([]);
  const [pending, setPending] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    try { setHistory(JSON.parse(localStorage.getItem(historyKey) ?? "[]") as Activity[]); } catch { /* New history is safe. */ }
    void refresh();
  }, []);

  async function refresh() {
    try {
      const response = await fetch("/api/demo", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setState(data as DemoState);
      setError(undefined);
    } catch (problem) { setError((problem as Error).message); }
  }

  async function run(step: Step, label: string) {
    setPending(label);
    setError(undefined);
    try {
      const response = await fetch("/api/demo", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ step }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      const next = [result.activity as Activity, ...history];
      setHistory(next);
      setState(result.state as DemoState);
      try { localStorage.setItem(historyKey, JSON.stringify(next)); } catch { /* Keep the current session visible. */ }
    } catch (problem) {
      await refresh();
      setError((problem as Error).message);
    } finally { setPending(undefined); }
  }

  const policy = state?.policy;
  const incident = state?.incident?.policy_id === policy?.id ? state?.incident : null;
  const status = policy?.phase ?? "No policy";
  const voteCount = Number(Boolean((policy?.votes ?? 0) & 1)) + Number(Boolean((policy?.votes ?? 0) & 2));
  const button = (step: Step, label: string, enabled: boolean) => (
    <button type="button" disabled={!!pending || !enabled} onClick={() => void run(step, label)}>{label}</button>
  );

  return (
    <>
      <div className="demo-status" aria-live="polite">
        <span>{pending ? `${pending} · Waiting for NEAR finality…` : state ? "Connected to NEAR testnet" : "Checking demo configuration…"}</span>
        <button type="button" onClick={() => void refresh()} disabled={!!pending}>Refresh</button>
      </div>
      {error && <p role="alert" className="demo-error">{error}</p>}
      <div className="demo-grid">
        <section className="demo-panel" aria-labelledby="agent-console">
          <p className="eyebrow"><span /> RUNNER</p>
          <h2 id="agent-console">Agent Console</h2>
          <p className="demo-description">The scripted agent records a test loss and submits the wallet’s on-chain incident as evidence.</p>
          {state && <p className="demo-id">{state.runner}</p>}
          <div className="demo-actions">
            {button("loss", "Simulate 0.3 NEAR loss", policy?.phase === "Active" && !incident)}
            {button("submit", "Submit claim", policy?.phase === "Active" && !!incident)}
          </div>
          {incident && <p className="demo-description">Wallet incident recorded at block {incident.block_height.toLocaleString()}.</p>}
          <h3>Transaction trail</h3>
          {history.length === 0 ? <p className="demo-description">Transactions appear here after confirmation.</p> : (
            <ol className="demo-trail">
              {history.map(entry => <li key={entry.hash}>
                <strong>{entry.label}</strong><span className="demo-id">{entry.actor}</span>
                <a href={`${explorer}${entry.hash}`} target="_blank" rel="noreferrer">View testnet transaction ↗</a>
                {entry.receipt && <span className="demo-id" title={entry.receipt}>Transfer receipt {entry.receipt}</span>}
              </li>)}
            </ol>
          )}
        </section>
        <section className="demo-panel" aria-labelledby="coverage-dashboard">
          <p className="eyebrow"><span /> COVERAGE</p>
          <h2 id="coverage-dashboard">AgSurance Dashboard</h2>
          <div className="demo-policy"><strong>{policy ? `Policy #${policy.id}` : "Policy"}</strong><span>{status === "Paid" ? "Reimbursed" : status}</span></div>
          <dl className="demo-amounts">
            <div><dt>Policy premium</dt><dd>{state ? near(state.premium) : "—"}</dd></div>
            <div><dt>Policy limit</dt><dd>{state ? near(state.limit) : "—"}</dd></div>
            <div><dt>Reserve locked</dt><dd>{state ? near(state.reserved) : "—"}</dd></div>
            <div><dt>Reserve balance</dt><dd>{state ? near(state.reserve) : "—"}</dd></div>
          </dl>
          {button("buy", "Buy demo policy", !!state && (!policy || policy.phase === "Paid"))}
          <h3>Claim review</h3>
          <dl className="demo-amounts">
            <div><dt>Recorded loss</dt><dd>{incident ? near(incident.amount) : "—"}</dd></div>
            <div><dt>Deductible</dt><dd>{state ? near(state.deductible) : "—"}</dd></div>
            <div><dt>Approvals</dt><dd>{voteCount} / 2 required</dd></div>
            <div className={status === "Paid" ? "demo-reimbursed" : ""}><dt>{status === "Paid" ? "Reimbursed" : "Claim payout"}</dt><dd>{policy && policy.payout !== "0" ? near(policy.payout) : "—"}</dd></div>
          </dl>
          <div className="demo-actions">
            {button("review1", "Approve as reviewer 1", status === "InReview" && voteCount === 0)}
            {button("review2", "Approve as reviewer 2", status === "InReview" && voteCount === 1)}
            {button("pay", "Pay claim", status === "Approved")}
          </div>
          {state && <p className="demo-id">Recovery account · {state.beneficiary}</p>}
        </section>
      </div>
    </>
  );
}
