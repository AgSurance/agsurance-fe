"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { NearConnector, NearWalletBase } from "@hot-labs/near-connect";
import { CHECKOUT_GAS, checkoutTotal, evidenceIsCovered, parseNear, projectStatus, TESTNET_RPC, type Activity, type AppStatus, type DemoState, type Evidence, type Step } from "../../lib/demo-state";

const explorer = "https://testnet.nearblocks.io/txns/";
const historyKey = "agsurance-testnet-activity";
const walletPendingKey = (vault: string) => `agsurance-wallet-pending-${vault}`;
type WalletPending = { query: string; activity: Activity };
function near(value: string) {
  const digits = value.padStart(25, "0");
  const whole = digits.slice(0, -24);
  const fraction = digits.slice(-24).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction} NEAR` : `${whole} NEAR`;
}

export function DemoConsole({ hosted = false }: { hosted?: boolean }) {
  const [state, setState] = useState<DemoState>();
  const [history, setHistory] = useState<Activity[]>([]);
  const [pending, setPending] = useState<string>();
  const [error, setError] = useState<string>();
  const [publicKey, setPublicKey] = useState("");
  const [supplierInput, setSupplier] = useState<string>();
  const [limitInput, setLimit] = useState("0.05");
  const [limitVisited, setLimitVisited] = useState(false);
  const [lossInput, setLossInput] = useState<{ policy: string; hash: string }>();
  const [checkedEvidence, setCheckedEvidence] = useState<{ policy: string; evidence: Evidence }>();
  const [walletConnection, setWalletConnection] = useState<{ wallet: NearWalletBase; role: "owner" | "recovery" }>();
  const [walletPending, setWalletPending] = useState<WalletPending>();
  const ownerWallet = walletConnection?.role === "owner" ? walletConnection.wallet : undefined;
  const recoveryWallet = walletConnection?.role === "recovery" ? walletConnection.wallet : undefined;
  const connector = useRef<NearConnector | null>(null);
  const requestId = useRef(0);
  const latestSnapshot = useRef(0);

  const acceptSnapshot = useCallback((id: number, snapshot: DemoState) => {
    if (id < latestSnapshot.current) return;
    latestSnapshot.current = id;
    setState(previous => previous?.vault === snapshot.vault && (previous.blockHeight ?? 0) > (snapshot.blockHeight ?? 0)
      ? previous : snapshot);
  }, []);

  const liveCoverage = !!state?.coverage;
  useEffect(() => {
    if (!liveCoverage || pending) return;
    const controller = new AbortController();
    let polling = false;
    const timer = setInterval(async () => {
      if (polling) return;
      polling = true;
      const id = ++requestId.current;
      try {
        const response = await fetch("/api/demo", { cache: "no-store", signal: controller.signal });
        if (response.ok) {
          const snapshot = await response.json() as DemoState;
          if (!controller.signal.aborted) {
            acceptSnapshot(id, snapshot);
          }
        }
      } catch { /* Keep the last confirmed state when a poll fails. */ }
      finally { polling = false; }
    }, 5000);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [acceptSnapshot, liveCoverage, pending]);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const response = await fetch("/api/demo", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      acceptSnapshot(id, data as DemoState);
      try {
        const saved = localStorage.getItem(walletPendingKey(data.vault));
        if (saved) setWalletPending(JSON.parse(saved) as WalletPending);
      } catch { /* The current session can still reconcile. */ }
      setError(undefined);
    } catch (problem) { setError((problem as Error).message); }
  }, [acceptSnapshot]);

  useEffect(() => {
    try { setHistory(JSON.parse(localStorage.getItem(historyKey) ?? "[]") as Activity[]); } catch { /* New history is safe. */ }
    void refresh();
  }, [refresh]);

  function remember(activity: Activity) {
    const next = [activity, ...history.filter(entry => entry.hash !== activity.hash)];
    setHistory(next);
    try { localStorage.setItem(historyKey, JSON.stringify(next)); } catch { /* Keep the current session visible. */ }
  }

  async function run(step: Step | "reconcile", label: string, key?: string) {
    const id = ++requestId.current;
    setPending(label);
    setError(undefined);
    try {
      const response = await fetch("/api/demo", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
          step, publicKey: key, mandate, lossTx, expectedPolicyId: policy?.id ?? null, expectedCheckoutId: checkout?.policy_id ?? null,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      remember(result.activity as Activity);
      acceptSnapshot(id, result.state as DemoState);
    } catch (problem) {
      await refresh();
      setError((problem as Error).message);
    } finally { setPending(undefined); }
  }

  async function connectWallet(role: "owner" | "recovery") {
    const accountId = role === "owner" ? state?.owner : state?.beneficiary;
    setPending(`Connect ${role} wallet`);
    setError(undefined);
    try {
      if (!connector.current) {
        const { NearConnector } = await import("@hot-labs/near-connect");
        connector.current = new NearConnector({ network: "testnet", autoConnect: false, providers: { testnet: [TESTNET_RPC] } });
      }
      if (walletConnection) {
        await connector.current.disconnect(walletConnection.wallet);
        setWalletConnection(undefined);
      }
      const wallet = await connector.current.connect();
      const accounts = await wallet.getAccounts({ network: "testnet" });
      if (!accounts.some(account => account.accountId === accountId)) {
        await connector.current.disconnect(wallet);
        throw new Error(`Select the ${role} wallet: ${accountId}`);
      }
      setWalletConnection({ wallet, role });
    } catch (problem) { setError((problem as Error).message); }
    finally { setPending(undefined); }
  }

  async function confirmWalletAction(entry: WalletPending) {
    const id = ++requestId.current;
    const response = await fetch(`/api/demo?${entry.query}`, { cache: "no-store" });
    const data = await response.json();
    if (response.ok || data.code === "transaction_failed" || data.code === "transaction_mismatch") {
      setWalletPending(undefined);
      try { localStorage.removeItem(walletPendingKey(entry.activity.vault!)); } catch { /* Keep the current session usable. */ }
    }
    if (!response.ok) throw new Error(data.error);
    acceptSnapshot(id, data as DemoState);
    remember(entry.activity);
  }

  async function checkWalletAction() {
    if (!walletPending) return;
    setPending("Check wallet transaction");
    setError(undefined);
    try { await confirmWalletAction(walletPending); }
    catch (problem) { setError((problem as Error).message); }
    finally { setPending(undefined); }
  }

  async function walletAction(step: Exclude<Step, "loss" | "submit" | "review1" | "review2" | "review3" | "pay" | "escalate" | "close">, label: string) {
    if (!state) return;
    const recovery = ["pause", "recover", "premium-refund", "recovery-claim"].includes(step);
    const wallet = recovery ? recoveryWallet : ownerWallet;
    const signer = recovery ? state.beneficiary : state.owner;
    if (!wallet) {
      if (recovery ? state.demoRecovery : state.demoOwner) await run(step, label, step === "connect" ? publicKey.trim() : undefined);
      return;
    }
    const methods = {
      buy: { methodName: "buy_policy", args: { ...(mandate ?? {}), expected_policy_id: state.policy?.id ?? 0 }, deposit: checkoutTotal(state) },
      refund: { methodName: "retry_checkout_refund", args: { policy_id: state.checkout?.policy_id }, deposit: "0" },
      connect: {
        methodName: "connect_agent",
        args: { policy_id: state.policy?.id, public_key: publicKey.trim() },
        deposit: state.agent_funding ?? "0",
      },
      revoke: { methodName: "revoke_agent", args: { policy_id: state.policy?.id }, deposit: "1" },
      pause: { methodName: "pause_wallet", args: { policy_id: state.policy?.id }, deposit: "0" },
      recover: { methodName: "recover_wallet", args: { policy_id: state.policy?.id }, deposit: "0" },
      "premium-refund": { methodName: "refund_unused_premium", args: { policy_id: state.policy?.id }, deposit: "0" },
      "recovery-claim": { methodName: "submit_claim", args: { policy_id: state.policy?.id }, deposit: "0" },
    };
    setPending(label);
    setError(undefined);
    try {
      const result = await wallet.signAndSendTransaction({
        network: "testnet", signerId: signer, receiverId: state.vault,
        actions: [{ type: "FunctionCall", params: { ...methods[step], gas: step === "buy" && state.reserve_pool ? CHECKOUT_GAS : "75000000000000" } }],
      });
      if (result?.status && typeof result.status === "object") {
        if ("Failure" in result.status || ("SuccessValue" in result.status && atob(result.status.SuccessValue) === "false")) {
          throw new Error("The wallet transaction did not complete. Check the transaction in your wallet.");
        }
      }
      const hash = result?.transaction?.hash;
      if (typeof hash === "string") {
        const query = new URLSearchParams({ owner_tx: hash, method: methods[step].methodName });
        if (state.policy && (recovery || step === "connect" || step === "revoke")) query.set("policy_id", String(state.policy.id));
        if (step === "refund" && state.checkout) query.set("policy_id", String(state.checkout.policy_id));
        if (step === "connect") query.set("public_key", publicKey.trim());
        if (step === "buy" && mandate) {
          query.set("supplier", mandate.supplier);
          query.set("limit", mandate.limit);
        }
        const entry = { query: query.toString(), activity: { label, actor: signer ?? "Owner wallet", hash, policyId: state.policy?.id, vault: state.vault } };
        setWalletPending(entry);
        try { localStorage.setItem(walletPendingKey(state.vault), JSON.stringify(entry)); } catch { /* Keep the current session usable. */ }
        await confirmWalletAction(entry);
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
  const model = state && (state.status ?? projectStatus(state));
  const ready = (action: keyof AppStatus["actions"]) => model?.actions[action] === "available";
  const transactionPending = model?.pendingTransaction;
  const externalPending = walletPending?.activity.vault === state?.vault ? walletPending : undefined;
  const actionPending = !!pending || !!transactionPending || !!externalPending;
  const supplier = supplierInput ?? state?.suggestedSupplier ?? "";
  const maxLimit = state?.max_supplier_limit;
  const limit = hosted ? maxLimit : parseNear(limitInput);
  const exceedsLimit = !!maxLimit && !!limit && BigInt(limit) > BigInt(maxLimit);
  const limitError = exceedsLimit ? `Enter a spending cap of ${near(maxLimit)} or less.`
    : !limit ? "Enter a valid spending cap in NEAR."
    : limit === "0" ? "Enter a spending cap greater than 0 NEAR." : undefined;
  const visibleLimitError = limitVisited || exceedsLimit ? limitError : undefined;
  const mandate = maxLimit && supplier.endsWith(".testnet") && limit && !limitError
    ? { supplier, limit } : undefined;
  const visibleHistory = hosted ? history.filter(entry => entry.vault === state?.vault) : history;
  const policyKey = `${state?.vault}/${policy?.id}`;
  const recordedLoss = history.find(entry => entry.label === "Simulated loss confirmed" &&
    entry.policyId === policy?.id && entry.vault === state?.vault);
  const typedLoss = lossInput?.policy === policyKey ? lossInput.hash : undefined;
  const lossTx = (policy?.evidence?.transaction_hash ?? state?.lossProof?.hash ?? typedLoss ?? recordedLoss?.hash ?? "").trim();
  const evidence = policy?.evidence ?? (checkedEvidence?.policy === policyKey &&
    checkedEvidence.evidence.transaction_hash === lossTx ? checkedEvidence.evidence : undefined);
  const canReview = !policy?.mandate || !!evidence;
  const rejectEvidence = !!state && !!evidence && !evidenceIsCovered(state, evidence);
  const checkout = state?.checkout;
  const checkoutStatus = checkout ? {
    Booking: "Checking reserve capacity",
    Funding: "Funding wallet",
    Releasing: "Releasing reserve",
    ReleaseAvailable: "Reserve release needs retry",
    Refunding: "Refund pending",
    RefundAvailable: "Refund available",
  }[checkout.phase] : undefined;
  const reserveStatus = state?.reserveStatus;
  const reserveDeficit = reserveStatus && reserveStatus.shortfall !== "0";
  const capacityFull = !!reserveStatus && !!state && BigInt(reserveStatus.available) < BigInt(state.limit);
  const reviewDeadline = policy?.review_deadline;
  const coverage = state?.coverage;
  const policyStatus = status === "Paid" ? "Reimbursed" : status === "CheckingEvidence" ? "Checking claim evidence"
    : status === "InReview" ? "In review" : status === "Paying" ? "Payout pending"
    : status === "Closing" ? "Releasing reserve" : status === "Rejected" ? "Claim rejected" : status === "Active" && coverage
    ? model?.coverage === "retired" ? "Retired" : model?.coverage === "ended" ? "Coverage ended" : coverage.paused ? "Paused" : coverage.active ? "Active" : "Coverage inactive"
    : status;
  const recoveryReady = !!recoveryWallet || !!state?.demoRecovery;
  const ownerReady = !!ownerWallet || !!state?.demoOwner;
  const keyLooksValid = /^ed25519:[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(publicKey.trim());
  const votes = policy?.votes ?? 0;
  const voteCount = [1, 2, 4].filter(mask => votes & mask).length;
  const button = (step: Step, label: string, enabled: boolean) => (
    <button type="button" disabled={actionPending || !enabled || !ready(step)} onClick={() => void run(step, label)}>{label}</button>
  );

  const showCheckout = !!state && !checkout && !coverage?.paused && (!policy || status === "Paid" || status === "Closed");
  const ownerConnection = !hosted && state?.owner && !ownerWallet && (
    <button type="button" className={ownerReady ? "demo-secondary" : undefined} disabled={!!pending} onClick={() => void connectWallet("owner")}>Connect owner wallet</button>
  );
  const checkoutForm = showCheckout && state && (
    <>
      {state.max_supplier_limit && (
        <div className="demo-mandate">
          <label htmlFor="supplier">Approved supplier account</label>
          <input id="supplier" readOnly={hosted} value={supplier} onChange={event => setSupplier(event.target.value)} />
          <label htmlFor="supplier-limit">Supplier spending cap (NEAR)</label>
          <input id="supplier-limit" readOnly={hosted} inputMode="decimal" value={hosted && maxLimit ? near(maxLimit).split(" ")[0] : limitInput}
            aria-describedby="supplier-limit-help" aria-invalid={visibleLimitError ? true : undefined}
            onChange={event => setLimit(event.target.value)} onBlur={() => setLimitVisited(true)} />
          <small id="supplier-limit-help" className={visibleLimitError ? "demo-field-error" : undefined} aria-live="polite">
            {visibleLimitError ?? `Maximum for this demo: ${near(state.max_supplier_limit)}.`}
          </small>
        </div>
      )}
      <div className="demo-checkout">
        <div>
          <strong>{near(checkoutTotal(state))} plus network fees</strong>
          <p>{state.wallet_funding ? `${near(state.wallet_funding)} wallet funding + ${near(state.premium)} premium` : "Policy premium"}</p>
        </div>
        <div className="demo-actions">
          <button type="button" disabled={actionPending || !ownerReady || !ready("buy") || (!!state.max_supplier_limit && !mandate)}
            onClick={() => void walletAction("buy", state.wallet_funding ? "Fund wallet and buy policy" : "Buy policy")}>
            {state.wallet_funding ? "Fund wallet and buy policy" : ownerWallet ? "Buy policy" : "Buy demo policy"}
          </button>
          {ownerConnection}
        </div>
      </div>
    </>
  );

  let nextAction: ReactNode;
  if (ready("refund")) {
    nextAction = <>{!ownerReady && ownerConnection}<button type="button" disabled={actionPending || !ownerReady}
      onClick={() => void walletAction("refund", "Retry checkout refund")}>Retry checkout refund</button></>;
  } else if (!hosted && ready("close")) {
    nextAction = button("close", status === "Closing" ? "Check or retry reserve release" : "Close policy and release reserve", true);
  } else if (ready("pay")) {
    nextAction = button("pay", status === "Paying" ? "Check or retry payout" : "Pay claim", true);
  } else if (!actionPending && !checkout && !showCheckout && status !== "Paid") {
    if (status === "InReview") nextAction = <a href="#claim-review">Go to claim review</a>;
    else if (!hosted && ready("connect")) nextAction = <a href="#agent-access">Go to agent setup</a>;
    else if (ready("loss") || ready("submit") || ready("agent-claim") || ready("renew")) nextAction = <a href="#agent-console">Go to Agent Console</a>;
    else if (!hosted && (ready("recover") || ready("recovery-claim") || ready("premium-refund"))) nextAction = <a href="#recovery">Go to wallet recovery</a>;
  }

  return (
    <>
      <div className="demo-status" aria-live="polite">
        <span>{pending ? `${pending} · Waiting for NEAR finality…` : state ? "Last confirmed NEAR testnet snapshot" : "Checking demo configuration…"}</span>
        <button type="button" onClick={() => void refresh()} disabled={!!pending}>Refresh</button>
      </div>
      {transactionPending && <p className="demo-status">
        <a href={`${explorer}${transactionPending.transactionHash}`} target="_blank" rel="noreferrer">View pending transaction ↗</a>
        <button type="button" disabled={!!pending} onClick={() => void run("reconcile", "Check transaction")}>Check transaction</button>
      </p>}
      {externalPending && <p className="demo-status">
        <a href={`${explorer}${externalPending.activity.hash}`} target="_blank" rel="noreferrer">View wallet transaction ↗</a>
        <button type="button" disabled={!!pending} onClick={() => void checkWalletAction()}>Check wallet transaction</button>
      </p>}
      {error && <p role="alert" className="demo-error">{error}</p>}
      <section className="demo-panel demo-overview" aria-labelledby="policy-overview">
        <div className="demo-policy" aria-live="polite">
          <h2 id="policy-overview">{checkout ? `Checkout #${checkout.policy_id}` : policy ? `Policy #${policy.id}` : "Policy"}</h2>
          <span>{checkoutStatus ?? policyStatus}</span>
        </div>
        {policy?.phase === "Paid" && !checkout && (
          <div className="demo-payout-summary">
            <strong>{near(policy.payout)} reimbursed</strong>
            {state?.payoutProof && <a className="demo-proof" href={`${explorer}${state.payoutProof.hash}/receipts`} target="_blank" rel="noreferrer">Verify final payout receipt ↗</a>}
          </div>
        )}
        {reserveDeficit && <p className="demo-error">Reserve shortfall of {near(reserveStatus.shortfall)}. New policies and payouts are paused. Claims can still be filed and reviewed.</p>}
        {!reserveDeficit && capacityFull && <p className="demo-description">The reserve has no capacity for another policy.</p>}
        {checkoutForm && (status === "Paid"
          ? <details className="demo-new-policy"><summary>Buy another policy</summary>{checkoutForm}</details>
          : checkoutForm)}
        {nextAction && <div className="demo-actions">{nextAction}</div>}
      </section>
      <div className="demo-grid">
        <section className="demo-panel" aria-labelledby="coverage-dashboard">
          <p className="eyebrow"><span /> COVERAGE</p>
          <h2 id="coverage-dashboard">AgSurance Dashboard</h2>
          {coverage && policy && (
            <div className="demo-agent">
              <h3>Premium and coverage</h3>
              <p>{coverage.retired ? "Wallet retired" : status === "Paid" ? "Claim paid · demo policy complete" : coverage.renewal_pending ? "Premium confirmation pending" :
              model?.coverage === "ended" ? "Coverage ended · supplier payments stopped" :
              coverage.active ? `Coverage active · period ${(coverage.current_window ?? 0) + 1} of 4` : "Coverage inactive · supplier payments paused"}</p>
              {model?.filingDeadline && ["Active", "Rejected", "Closing"].includes(status) &&
                <p className="demo-description">Claim filing deadline · {new Date(model.filingDeadline * 1000).toLocaleString()}</p>}
              {!coverage.retired && coverage.next_boundary && <p className="demo-description">Current period ends {new Date(coverage.next_boundary * 1000).toLocaleString()}.</p>}
              {!coverage.retired && coverage.current_window != null && policy.windows?.[coverage.current_window + 1] != null &&
                <p className="demo-description">Period {coverage.current_window + 2} premium confirmed.</p>}
              {coverage.payable_window != null && !coverage.renewal_pending && !coverage.paused && <p className="demo-description">
                Period {coverage.payable_window + 1} premium is due. The agent can pay {near(state.premium)} from the wallet.
                {state.operatingBalance && BigInt(state.operatingBalance) < BigInt(state.premium) && " Top up the operating balance before retrying."}
              </p>}
              {state.operatingBalance && <p className="demo-description">Operating balance · {near(state.operatingBalance)}</p>}
            </div>
          )}
          <dl className="demo-amounts">
            {!showCheckout && <div><dt>Policy premium</dt><dd>{state ? near(state.premium) : "—"}</dd></div>}
            <div><dt>Policy limit</dt><dd>{state ? near(state.limit) : "—"}</dd></div>
            <div><dt>Reserve locked</dt><dd>{state ? near(state.reserved) : "—"}</dd></div>
            <div><dt>Reserve balance</dt><dd>{reserveStatus ? near(reserveStatus.assets) : state?.reserve ? near(state.reserve) : "—"}</dd></div>
            {reserveStatus && <>
              <div><dt>Locked across policies</dt><dd>{near(reserveStatus.locked)}</dd></div>
              <div><dt>Available for new policies</dt><dd>{near(reserveStatus.available)}</dd></div>
              <div><dt>Payouts in progress</dt><dd>{near(reserveStatus.pending)}</dd></div>
            </>}
          </dl>
          {policy?.mandate && <p className="demo-id">Policy mandate · {policy.mandate.supplier} · {near(policy.mandate.limit)}</p>}
          {!showCheckout && !ready("refund") && ownerConnection && <div className="demo-actions">{ownerConnection}</div>}
          {state?.wallet_funding && <p className="demo-id">Agent wallet · {state.wallet}</p>}
          {state?.owner && <p className="demo-id">{ownerWallet ? "Connected owner" : state.demoOwner ? hosted ? "Testnet demo owner" : "Local demo signer" : "Policy owner"} · {state.owner}</p>}
          {!hosted && state?.agent_funding && (
            <section className="demo-agent" aria-labelledby="agent-access">
              <h3 id="agent-access">Agent access</h3>
              {state.agent?.connected ? (
                <>
                  <p>Agent connected</p>
                  <p className="demo-id">{state.agent.account_id}</p>
                  <button type="button" disabled={actionPending || !ownerReady || !ready("revoke")} onClick={() => void walletAction("revoke", "Revoke agent")}>Revoke agent</button>
                </>
              ) : state.agent ? <p>Waiting for account creation.</p> : ready("connect") ? (
                <form onSubmit={event => { event.preventDefault(); void walletAction("connect", "Connect Agent"); }}>
                  <p className="demo-description">Run <code>bun scripts/agent.ts init .agsurance-agent.key</code> in the agent runtime, then paste its public key. The owner funds {near(state.agent_funding)} for the agent account.</p>
                  <label htmlFor="agent-public-key">Agent public key</label>
                  <input id="agent-public-key" autoComplete="off" spellCheck={false} placeholder="ed25519:…" value={publicKey} onChange={event => setPublicKey(event.target.value)} />
                  <button type="submit" disabled={actionPending || !ownerReady || !keyLooksValid}>Connect Agent</button>
                </form>
              ) : <p className="demo-description">Activate a policy to connect an agent.</p>}
            </section>
          )}
          {!hosted && coverage && policy && (
            <section className="demo-agent" aria-labelledby="recovery">
              <h3 id="recovery">Wallet recovery</h3>
              <p className="demo-description">Stop the agent, then move the remaining operating balance to the registered recovery account. An eligible claim can still be filed.</p>
              {state.recoveryProof && <a className="demo-proof" href={`${explorer}${state.recoveryProof.hash}/receipts`} target="_blank" rel="noreferrer">Verify wallet balance recovery ↗</a>}
              {coverage.paused && <p>{coverage.retired ? "Recovered · wallet retired" : coverage.recovery_pending ? "Recovery pending" : "Agent access stopped"}</p>}
              <div className="demo-actions">
                {!recoveryWallet && <button type="button" disabled={!!pending} onClick={() => void connectWallet("recovery")}>Connect recovery wallet</button>}
                <button type="button" disabled={actionPending || !recoveryReady || !ready("pause")}
                  onClick={() => void walletAction("pause", "Stop agent access")}>Stop agent access</button>
                <button type="button" disabled={actionPending || !recoveryReady || !ready("recover")}
                  onClick={() => void walletAction("recover", "Recover wallet balance")}>Recover wallet balance</button>
                {ready("premium-refund") && <button type="button" disabled={actionPending || !recoveryReady}
                  onClick={() => void walletAction("premium-refund", "Refund unused premium")}>Refund unused premium</button>}
                {ready("recovery-claim") && <button type="button" disabled={actionPending || !recoveryReady}
                  onClick={() => void walletAction("recovery-claim", "File claim from recovery account")}>File claim from recovery account</button>}
              </div>
            </section>
          )}
          <h3 id="claim-review">Claim review</h3>
          {policy?.escalated_at && (
            <p className="demo-description">
              Escalation recorded {new Date(policy.escalated_at * 1000).toLocaleString()}.
              {status === "InReview" && " The claim stays open and its reserve remains locked while the panel reviews it."}
            </p>
          )}
          {status === "InReview" && reviewDeadline && !policy?.escalated_at &&
            <p className="demo-description">Panel review deadline · {new Date(reviewDeadline * 1000).toLocaleString()}</p>}
          <dl className="demo-amounts">
            <div><dt>Recorded loss</dt><dd>{incident ? near(incident.amount) : "—"}</dd></div>
            <div><dt>Deductible</dt><dd>{state ? near(state.deductible) : "—"}</dd></div>
            <div><dt>Approvals</dt><dd>{voteCount} / 2 required</dd></div>
            <div className={status === "Paid" ? "demo-reimbursed" : ""}><dt>{status === "Paid" ? "Reimbursed" : "Claim payout"}</dt><dd>{policy && policy.payout !== "0" ? near(policy.payout) : "—"}</dd></div>
          </dl>
          {policy?.mandate && status === "InReview" && (
            <div className="demo-mandate">
              <label htmlFor="loss-transaction">Simulated loss transaction hash</label>
              <input id="loss-transaction" value={lossTx} onChange={event => setLossInput({ policy: policyKey, hash: event.target.value })} disabled={hosted || !!policy.evidence} />
              <button type="button" disabled={!!pending || !lossTx || !!policy.evidence} onClick={() => void inspectEvidence()}>Verify loss receipt</button>
            </div>
          )}
          {evidence && (
            <p className="demo-description">
              Verified transfer of {near(evidence.amount)} to {evidence.recipient} at block {evidence.block_height.toLocaleString()}.
              {rejectEvidence && " The transfer occurred outside paid coverage."}
              <br /><a className="demo-proof" href={`${explorer}${evidence.transaction_hash}/receipts`} target="_blank" rel="noreferrer">View loss receipt ↗</a>
            </p>
          )}
          <div className="demo-actions">
            {button("review1", `${rejectEvidence ? "Reject" : "Approve"} as reviewer 1`, canReview)}
            {button("review2", `${rejectEvidence ? "Reject" : "Approve"} as reviewer 2`, canReview)}
            {state?.reserve_pool && button("review3", `${rejectEvidence ? "Reject" : "Approve"} as reviewer 3`, canReview)}
            {!hosted && status === "InReview" && reviewDeadline && !policy?.escalated_at
              ? button("escalate", "Record escalation", true)
              : null}
          </div>
          {ready("pay") && <a className="demo-proof" href="#policy-overview">Go to payout ↗</a>}
          {state && <p className="demo-id">Recovery account · {state.beneficiary}</p>}
          {state && policy && !["Active", "CheckingEvidence"].includes(policy.phase) &&
            <p className="demo-id">Claim ID · {state.vault}/{policy.id}</p>}
        </section>
        <section className="demo-panel" aria-labelledby="agent-console">
          <p className="eyebrow"><span /> RUNNER</p>
          <h2 id="agent-console">Agent Console</h2>
          <p className="demo-description">{hosted ? "The test runner records a simulated loss. The demo policy owner files the claim." : "The fixture records a test loss. A connected agent submits the claim from its own CLI."}</p>
          {state?.agent_funding && <p className="demo-id">Vault · {state.vault}</p>}
          <div className="demo-actions">
            {button("loss", "Simulate 0.3 NEAR loss", true)}
            {(hosted || !state?.owner) && button("submit", "Submit claim", true)}
          </div>
          {incident && <p className="demo-description">Wallet incident recorded at block {incident.block_height.toLocaleString()}.</p>}
          {state?.agent?.connected && (
            <div className="demo-command">
              <p>Run these commands from the connected agent runtime.</p>
              <code>bun scripts/agent.ts status {state.vault}</code>
              {policy?.mandate && <code>bun scripts/agent.ts pay {state.vault} .agsurance-agent.key {policy.mandate.supplier} {near(policy.mandate.limit).split(" ")[0]}</code>}
              {coverage && <code>bun scripts/agent.ts renew {state.vault} .agsurance-agent.key</code>}
              <code>bun scripts/agent.ts submit-claim {state.vault} .agsurance-agent.key</code>
            </div>
          )}
        </section>
      </div>
      <section className="demo-panel demo-history" aria-labelledby="transaction-trail">
        <h2 id="transaction-trail">Transaction trail</h2>
        {visibleHistory.length === 0 ? <p className="demo-description">Transactions appear here after confirmation.</p> : (
          <ol className="demo-trail">
            {visibleHistory.map(entry => <li key={entry.hash}>
              <strong>{entry.label}</strong><span className="demo-id">{entry.actor}</span>
              <a href={`${explorer}${entry.hash}`} target="_blank" rel="noreferrer">View testnet transaction ↗</a>
              {entry.receipt && <span className="demo-id" title={entry.receipt}>Transfer receipt {entry.receipt}</span>}
            </li>)}
          </ol>
        )}
      </section>
    </>
  );
}
