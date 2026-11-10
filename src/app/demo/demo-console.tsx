"use client";

import { useEffect, useRef, useState } from "react";
import type { NearConnector, NearWalletBase } from "@hot-labs/near-connect";
import { checkoutTotal, parseNear, TESTNET_RPC, type Activity, type DemoState, type Evidence, type Step } from "../../lib/demo-state";

const explorer = "https://testnet.nearblocks.io/txns/";
const historyKey = "agsurance-testnet-activity";
function near(value: string) {
  const digits = value.padStart(25, "0");
  const whole = digits.slice(0, -24);
  const fraction = digits.slice(-24).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction} NEAR` : `${whole} NEAR`;
}

export function DemoConsole() {
  const [state, setState] = useState<DemoState>();
  const [history, setHistory] = useState<Activity[]>([]);
  const [pending, setPending] = useState<string>();
  const [error, setError] = useState<string>();
  const [publicKey, setPublicKey] = useState("");
  const [supplierInput, setSupplier] = useState<string>();
  const [limitInput, setLimit] = useState("0.05");
  const [lossInput, setLossInput] = useState<{ policy: string; hash: string }>();
  const [checkedEvidence, setCheckedEvidence] = useState<{ policy: string; evidence: Evidence }>();
  const [ownerWallet, setOwnerWallet] = useState<NearWalletBase>();
  const connector = useRef<NearConnector | null>(null);

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

  async function run(step: Step, label: string, key?: string) {
    setPending(label);
    setError(undefined);
    try {
      const response = await fetch("/api/demo", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ step, publicKey: key, mandate, lossTx }),
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

  async function connectOwner() {
    setPending("Connect owner wallet");
    setError(undefined);
    try {
      if (!connector.current) {
        const { NearConnector } = await import("@hot-labs/near-connect");
        connector.current = new NearConnector({ network: "testnet", autoConnect: false, providers: { testnet: [TESTNET_RPC] } });
      }
      const wallet = await connector.current.connect();
      const accounts = await wallet.getAccounts({ network: "testnet" });
      if (!accounts.some(account => account.accountId === state?.owner)) {
        await connector.current.disconnect(wallet);
        throw new Error(`Select the policy owner's wallet: ${state?.owner}`);
      }
      setOwnerWallet(wallet);
    } catch (problem) { setError((problem as Error).message); }
    finally { setPending(undefined); }
  }

  async function ownerAction(step: "buy" | "connect" | "revoke" | "refund", label: string) {
    if (!state) return;
    if (!ownerWallet) {
      if (state.demoOwner) await run(step, label, step === "connect" ? publicKey.trim() : undefined);
      return;
    }
    const methods = {
      buy: { methodName: "buy_policy", args: mandate ?? {}, deposit: checkoutTotal(state) },
      refund: { methodName: "retry_checkout_refund", args: {}, deposit: "0" },
      connect: {
        methodName: "connect_agent",
        args: { policy_id: state.policy?.id, public_key: publicKey.trim() },
        deposit: state.agent_funding ?? "0",
      },
      revoke: { methodName: "revoke_agent", args: { policy_id: state.policy?.id }, deposit: "1" },
    };
    setPending(label);
    setError(undefined);
    try {
      const result = await ownerWallet.signAndSendTransaction({
        network: "testnet", signerId: state.owner, receiverId: state.vault,
        actions: [{ type: "FunctionCall", params: { ...methods[step], gas: "75000000000000" } }],
      });
      if (result?.status && typeof result.status === "object") {
        if ("Failure" in result.status || ("SuccessValue" in result.status && atob(result.status.SuccessValue) === "false")) {
          throw new Error("The wallet transaction did not complete. Check the transaction in your wallet.");
        }
      }
      const hash = result?.transaction?.hash;
      if (typeof hash === "string") {
        const query = new URLSearchParams({ owner_tx: hash, method: methods[step].methodName });
        if (state.policy && (step === "connect" || step === "revoke")) query.set("policy_id", String(state.policy.id));
        if (step === "connect") query.set("public_key", publicKey.trim());
        if (step === "buy" && mandate) {
          query.set("supplier", mandate.supplier);
          query.set("limit", mandate.limit);
        }
        const response = await fetch(`/api/demo?${query}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setState(data as DemoState);
        const next = [{ label, actor: state.owner ?? "Owner wallet", hash }, ...history];
        setHistory(next);
        try { localStorage.setItem(historyKey, JSON.stringify(next)); } catch { /* Keep the current session visible. */ }
      } else {
        await refresh();
      }
    } catch (problem) {
      await refresh();
      setError((problem as Error).message);
    } finally { setPending(undefined); }
  }

  async function inspectEvidence() {
    setPending("Verify loss receipt");
    setError(undefined);
    try {
      const response = await fetch(`/api/demo?loss_tx=${encodeURIComponent(lossTx)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setCheckedEvidence({ policy: policyKey, evidence: data as Evidence });
    } catch (problem) { setError((problem as Error).message); }
    finally { setPending(undefined); }
  }

  const policy = state?.policy;
  const incident = state?.incident?.policy_id === policy?.id ? state?.incident : null;
  const status = policy?.phase ?? "No policy";
  const supplier = supplierInput ?? state?.suggestedSupplier ?? "";
  const limit = parseNear(limitInput);
  const mandate = state?.max_supplier_limit && supplier.endsWith(".testnet") && limit &&
    BigInt(limit) > BigInt(0) && BigInt(limit) <= BigInt(state.max_supplier_limit)
    ? { supplier, limit } : undefined;
  const policyKey = `${state?.vault}/${policy?.id}`;
  const recordedLoss = history.find(entry => entry.label === "Simulated loss confirmed" &&
    entry.policyId === policy?.id && entry.vault === state?.vault);
  const typedLoss = lossInput?.policy === policyKey ? lossInput.hash : undefined;
  const lossTx = (policy?.evidence?.transaction_hash ?? typedLoss ?? recordedLoss?.hash ?? "").trim();
  const evidence = policy?.evidence ?? (checkedEvidence?.policy === policyKey &&
    checkedEvidence.evidence.transaction_hash === lossTx ? checkedEvidence.evidence : undefined);
  const canReview = !policy?.mandate || !!evidence;
  const checkout = state?.checkout;
  const checkoutStatus = checkout ? {
    Funding: "Funding wallet",
    Refunding: "Refund pending",
    RefundAvailable: "Refund available",
  }[checkout.phase] : undefined;
  const ownerReady = !!ownerWallet || !!state?.demoOwner;
  const connectEnabled = !!state?.agent_funding && status === "Active" && !state.agent;
  const keyLooksValid = /^ed25519:[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(publicKey.trim());
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
          <p className="demo-description">The fixture records a test loss. A connected agent submits the claim from its own CLI.</p>
          {state?.agent_funding && <p className="demo-id">Vault · {state.vault}</p>}
          <div className="demo-actions">
            {button("loss", "Simulate 0.3 NEAR loss", policy?.phase === "Active" && !incident)}
            {!state?.owner && button("submit", "Submit claim", policy?.phase === "Active" && !!incident)}
          </div>
          {incident && <p className="demo-description">Wallet incident recorded at block {incident.block_height.toLocaleString()}.</p>}
          {state?.agent?.connected && (
            <div className="demo-command">
              <p>Run this from the agent runtime after recording the simulated loss.</p>
              <code>bun scripts/agent.ts status {state.vault}</code>
              {policy?.mandate && <code>bun scripts/agent.ts pay {state.vault} .agsurance-agent.key {policy.mandate.supplier} {near(policy.mandate.limit).split(" ")[0]}</code>}
              <code>bun scripts/agent.ts submit-claim {state.vault} .agsurance-agent.key</code>
            </div>
          )}
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
          <div className="demo-policy">
            <strong>{checkout ? `Checkout #${checkout.policy_id}` : policy ? `Policy #${policy.id}` : "Policy"}</strong>
            <span>{checkoutStatus ?? (status === "Paid" ? "Reimbursed" : status)}</span>
          </div>
          <dl className="demo-amounts">
            {state?.wallet_funding && <div><dt>Agent wallet funding</dt><dd>{near(state.wallet_funding)}</dd></div>}
            <div><dt>Policy premium</dt><dd>{state ? near(state.premium) : "—"}</dd></div>
            {state?.wallet_funding && <div className="demo-reimbursed"><dt>Checkout total, plus network fees</dt><dd>{near(checkoutTotal(state))}</dd></div>}
            <div><dt>Policy limit</dt><dd>{state ? near(state.limit) : "—"}</dd></div>
            <div><dt>Reserve locked</dt><dd>{state ? near(state.reserved) : "—"}</dd></div>
            <div><dt>Reserve balance</dt><dd>{state ? near(state.reserve) : "—"}</dd></div>
          </dl>
          {state?.max_supplier_limit && !checkout && (!policy || policy.phase === "Paid") && (
            <div className="demo-mandate">
              <label htmlFor="supplier">Approved supplier account</label>
              <input id="supplier" value={supplier} onChange={event => setSupplier(event.target.value)} />
              <label htmlFor="supplier-limit">Supplier spending cap (NEAR)</label>
              <input id="supplier-limit" inputMode="decimal" value={limitInput} onChange={event => setLimit(event.target.value)} />
              <small>Maximum for this demo: {near(state.max_supplier_limit)}.</small>
            </div>
          )}
          {policy?.mandate && <p className="demo-id">Policy mandate · {policy.mandate.supplier} · {near(policy.mandate.limit)}</p>}
          <div className="demo-actions">
            {state?.owner && !ownerWallet && <button type="button" disabled={!!pending} onClick={() => void connectOwner()}>Connect owner wallet</button>}
            {state && <button type="button" disabled={!!pending || !ownerReady || !!checkout || (!!state.max_supplier_limit && !mandate) || (!!policy && policy.phase !== "Paid")}
              onClick={() => void ownerAction("buy", state.wallet_funding ? "Fund wallet and buy policy" : "Buy policy")}>
              {state.wallet_funding ? "Fund wallet and buy policy" : ownerWallet ? "Buy policy" : "Buy demo policy"}
            </button>}
            {checkout?.phase === "RefundAvailable" && <button type="button" disabled={!!pending || !ownerReady}
              onClick={() => void ownerAction("refund", "Retry checkout refund")}>Retry checkout refund</button>}
          </div>
          {state?.wallet_funding && <p className="demo-id">Agent wallet · {state.wallet}</p>}
          {state?.owner && <p className="demo-id">{ownerWallet ? "Connected owner" : state.demoOwner ? "Local demo signer" : "Policy owner"} · {state.owner}</p>}
          {state?.agent_funding && (
            <section className="demo-agent" aria-labelledby="agent-access">
              <h3 id="agent-access">Agent access</h3>
              {state.agent?.connected ? (
                <>
                  <p>Agent connected</p>
                  <p className="demo-id">{state.agent.account_id}</p>
                  <button type="button" disabled={!!pending || !ownerReady} onClick={() => void ownerAction("revoke", "Revoke agent")}>Revoke agent</button>
                </>
              ) : state.agent ? <p>Waiting for account creation.</p> : connectEnabled ? (
                <form onSubmit={event => { event.preventDefault(); void ownerAction("connect", "Connect Agent"); }}>
                  <p className="demo-description">Run <code>bun scripts/agent.ts init .agsurance-agent.key</code> in the agent runtime, then paste its public key. The owner funds {near(state.agent_funding)} for the agent account.</p>
                  <label htmlFor="agent-public-key">Agent public key</label>
                  <input id="agent-public-key" autoComplete="off" spellCheck={false} placeholder="ed25519:…" value={publicKey} onChange={event => setPublicKey(event.target.value)} />
                  <button type="submit" disabled={!!pending || !ownerReady || !keyLooksValid}>Connect Agent</button>
                </form>
              ) : <p className="demo-description">Activate a policy to connect an agent.</p>}
            </section>
          )}
          <h3>Claim review</h3>
          <dl className="demo-amounts">
            <div><dt>Recorded loss</dt><dd>{incident ? near(incident.amount) : "—"}</dd></div>
            <div><dt>Deductible</dt><dd>{state ? near(state.deductible) : "—"}</dd></div>
            <div><dt>Approvals</dt><dd>{voteCount} / 2 required</dd></div>
            <div className={status === "Paid" ? "demo-reimbursed" : ""}><dt>{status === "Paid" ? "Reimbursed" : "Claim payout"}</dt><dd>{policy && policy.payout !== "0" ? near(policy.payout) : "—"}</dd></div>
          </dl>
          {policy?.mandate && status === "InReview" && (
            <div className="demo-mandate">
              <label htmlFor="loss-transaction">Simulated loss transaction hash</label>
              <input id="loss-transaction" value={lossTx} onChange={event => setLossInput({ policy: policyKey, hash: event.target.value })} disabled={!!policy.evidence} />
              <button type="button" disabled={!!pending || !lossTx || !!policy.evidence} onClick={() => void inspectEvidence()}>Verify loss receipt</button>
            </div>
          )}
          {evidence && (
            <p className="demo-description">
              Verified transfer of {near(evidence.amount)} to {evidence.recipient} at block {evidence.block_height.toLocaleString()}.
              <br /><a className="demo-proof" href={`${explorer}${evidence.transaction_hash}/receipts`} target="_blank" rel="noreferrer">View loss receipt ↗</a>
            </p>
          )}
          <div className="demo-actions">
            {button("review1", "Approve as reviewer 1", status === "InReview" && voteCount === 0 && canReview)}
            {button("review2", "Approve as reviewer 2", status === "InReview" && voteCount === 1 && canReview)}
            {button("pay", "Pay claim", status === "Approved")}
          </div>
          {state && <p className="demo-id">Recovery account · {state.beneficiary}</p>}
          {state && policy && !["Active", "CheckingEvidence"].includes(policy.phase) &&
            <p className="demo-id">Claim ID · {state.vault}/{policy.id}</p>}
          {state?.payoutProof && <a className="demo-proof" href={`${explorer}${state.payoutProof.hash}/receipts`} target="_blank" rel="noreferrer">Verify final payout receipt ↗</a>}
        </section>
      </div>
    </>
  );
}
