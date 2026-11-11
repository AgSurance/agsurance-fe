"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { NearConnector, NearWalletBase } from "@hot-labs/near-connect";
import { CHECKOUT_GAS, checkoutTotal, evidenceIsCovered, parseNear, projectStatus, TESTNET_RPC, type Activity, type AppStatus, type DemoState, type Evidence, type RecoveryRecipient, type Step, type TransferEvidence } from "../../lib/demo-state";

function demoApi(params?: URLSearchParams) {
  const query = new URLSearchParams(params);
  const vault = new URLSearchParams(window.location.search).get("vault");
  if (vault) query.set("vault", vault);
  return `/api/demo${query.size ? `?${query}` : ""}`;
}

const explorer = "https://testnet.nearblocks.io/txns/";
const historyKey = "agsurance-testnet-activity";
const walletPendingKey = (vault: string) => `agsurance-wallet-pending-${vault}`;
type WalletStep = "choose-recovery" | "submit-observed" | "buy" | "refund" | "connect" | "revoke" | "pause" | "recover" | "premium-refund" | "recovery-claim"
  | "rotate-agent" | "resume-wallet" | "record-claim-recovery";
type WalletPending = { query: string; activity: Activity };
function near(value: string) {
  const digits = value.padStart(25, "0");
  const whole = digits.slice(0, -24);
  const fraction = digits.slice(-24).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction} NEAR` : `${whole} NEAR`;
}

export function DemoConsole({ hosted = false, recoveryPreview = false }: { hosted?: boolean; recoveryPreview?: boolean }) {
  const [state, setState] = useState<DemoState>();
  const [history, setHistory] = useState<Activity[]>([]);
  const [pending, setPending] = useState<string>();
  const [error, setError] = useState<string>();
  const [publicKey, setPublicKey] = useState("");
  const [replacementKey, setReplacementKey] = useState("");
  const [recoveredNear, setRecoveredNear] = useState<{ policy: string; amount: string }>();
  const [supplierInput, setSupplier] = useState<string>();
  const [limitInput, setLimit] = useState("0.05");
  const [limitVisited, setLimitVisited] = useState(false);
  const [replacementVault, setReplacementVault] = useState<string>();
  const [beneficiaryInput, setBeneficiaryInput] = useState("");
  const [observedRefs, setObservedRefs] = useState("");
  const [observedSelection, setObservedSelection] = useState<{ policy: string; transfers: TransferEvidence[] }>();
  const [observedReview, setObservedReview] = useState<{ hash: string; verified: boolean }>();
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
        const response = await fetch(demoApi(), { cache: "no-store", signal: controller.signal });
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
      const response = await fetch(demoApi(), { cache: "no-store" });
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
    if (activity.label === "Recovered claim funds recorded") setRecoveredNear(undefined);
    if (activity.label === "Replacement agent connected") setReplacementKey("");
    const next = [activity, ...history.filter(entry => entry.hash !== activity.hash)];
    setHistory(next);
    try { localStorage.setItem(historyKey, JSON.stringify(next)); } catch { /* Keep the current session visible. */ }
  }

  async function run(step: Step | "reconcile", label: string, details: { publicKey?: string; recoveredAmount?: string; recipient?: RecoveryRecipient; beneficiary?: string; refs?: { transactionHash: string; signerId: string }[] } = {}) {
    const id = ++requestId.current;
    setPending(label);
    setError(undefined);
    try {
      const response = await fetch(demoApi(), {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
          step, ...details, mandate, lossTx, expectedPolicyId: policy?.id ?? null, expectedCheckoutId: checkout?.policy_id ?? null,
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
    const response = await fetch(demoApi(new URLSearchParams(entry.query)), { cache: "no-store" });
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

  async function walletAction(step: WalletStep, label: string) {
    if (!state || !ready(step) || actionPending || (step === "record-claim-recovery" && !canReportRecovery)) return;
    const recovery = ["pause", "recover", "premium-refund", "recovery-claim", "rotate-agent", "resume-wallet", "record-claim-recovery"].includes(step);
    const key = step === "connect" ? publicKey.trim() : step === "rotate-agent" ? replacementKey.trim() : undefined;
    const selectedBeneficiary = state.pending_beneficiary ?? beneficiaryInput.trim();
    const refs = [...new Map(selectedTransfers.map(transfer => [transfer.receipt.transaction_hash, {
      transactionHash: transfer.receipt.transaction_hash, signerId: transfer.signer_id,
    }])).values()];
    const wallet = recovery ? recoveryWallet : ownerWallet;
    const signer = recovery ? state.beneficiary : state.owner;
    if (!wallet) {
      if (recovery ? state.demoRecovery : state.demoOwner) {
        await run(step, label, {
          publicKey: key, recoveredAmount: step === "record-claim-recovery" ? recoveryAmount : undefined,
          beneficiary: step === "choose-recovery" ? selectedBeneficiary : undefined,
          refs: step === "submit-observed" ? refs : undefined,
        });
      }
      return;
    }
    const methods = {
      "choose-recovery": { methodName: "choose_recovery_account", args: { beneficiary: selectedBeneficiary }, deposit: "0" },
      "submit-observed": { methodName: "submit_evidence_claim", args: { policy_id: state.policy?.id, transfers: selectedTransfers }, deposit: "0" },
      buy: { methodName: "buy_policy", args: { ...(mandate ?? {}), expected_policy_id: state.policy?.id ?? 0 }, deposit: checkoutTotal(state) },
      refund: { methodName: "retry_checkout_refund", args: { policy_id: state.checkout?.policy_id }, deposit: "0" },
      connect: {
        methodName: "connect_agent",
        args: { policy_id: state.policy?.id, public_key: key },
        deposit: state.agent_funding ?? "0",
      },
      revoke: { methodName: "revoke_agent", args: { policy_id: state.policy?.id }, deposit: "1" },
      pause: { methodName: "pause_wallet", args: { policy_id: state.policy?.id }, deposit: "0" },
      recover: { methodName: "recover_wallet", args: { policy_id: state.policy?.id }, deposit: "0" },
      "premium-refund": { methodName: "refund_unused_premium", args: { policy_id: state.policy?.id }, deposit: "0" },
      "recovery-claim": { methodName: "submit_claim", args: { policy_id: state.policy?.id }, deposit: "0" },
      "rotate-agent": { methodName: "rotate_agent", args: { policy_id: state.policy?.id, public_key: key }, deposit: state.agent_funding ?? "0" },
      "resume-wallet": { methodName: "resume_wallet", args: { policy_id: state.policy?.id }, deposit: "0" },
      "record-claim-recovery": { methodName: "record_claim_recovery", args: { policy_id: state.policy?.id }, deposit: recoveryAmount! },
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
        if (state.policy && (recovery || step === "connect" || step === "revoke" || step === "submit-observed")) query.set("policy_id", String(state.policy.id));
        if (step === "refund" && state.checkout) query.set("policy_id", String(state.checkout.policy_id));
        if (key) query.set("public_key", key);
        if (step === "choose-recovery") query.set("beneficiary", selectedBeneficiary);
        if (step === "record-claim-recovery") query.set("deposit", methods[step].deposit);
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
      const response = await fetch(demoApi(new URLSearchParams({ loss_tx: lossTx })), { cache: "no-store" });
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
  const selectedTransfers = observedSelection?.policy === policyKey ? observedSelection.transfers : [];
  const observedClaim = policy?.observed_claim;
  const observedVerified = !!observedClaim && observedReview?.hash === observedClaim.evidence_hash;
  const observedTotal = selectedTransfers.reduce((total, transfer) => total + BigInt(transfer.receipt.amount), BigInt(0));
  async function setupReplacement() {
    setPending("Set up replacement wallet");
    setError(undefined);
    try {
      const response = await fetch(demoApi(), {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ step: "prepare-replacement", expectedPolicyId: policy?.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setReplacementVault(result.vault);
    } catch (problem) { setError((problem as Error).message); }
    finally { setPending(undefined); }
  }

  async function inspectObserved(mode: "watch" | "inspect" | "review") {
    setPending(mode === "review" ? "Verify submitted transfers" : "Check wallet transfers");
    setError(undefined);
    try {
      const params = new URLSearchParams({ observed: mode });
      if (mode === "inspect") {
        for (const line of observedRefs.split("\n").map(value => value.trim()).filter(Boolean)) params.append("ref", line);
      }
      const response = await fetch(demoApi(params));
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (mode === "review" && observedClaim) setObservedReview({ hash: observedClaim.evidence_hash, verified: result.verified });
      else setObservedSelection({ policy: policyKey, transfers: result });
    } catch (problem) { setError((problem as Error).message); }
    finally { setPending(undefined); }
  }
  const claimRecovery = state?.claim_recovery;
  const recoveryInput = hosted && recoveryPreview ? "0.05" : recoveredNear?.policy === policyKey ? recoveredNear.amount : "";
  const recoveryAmount = parseNear(recoveryInput);
  const outstandingLoss = policy && claimRecovery
    ? BigInt(policy.loss) - BigInt(claimRecovery.recovered_before_payout) - BigInt(claimRecovery.recovered_after_payout)
    : BigInt(0);
  const canReportRecovery = !!recoveryAmount && BigInt(recoveryAmount) > BigInt(0) && BigInt(recoveryAmount) <= outstandingLoss
    && (!hosted || (recoveryPreview && recoveryAmount === parseNear("0.05")
      && claimRecovery?.recovered_before_payout === "0" && policy?.phase !== "Paid"));
  const recordedLoss = history.find(entry => entry.label === "Simulated loss confirmed" &&
    entry.policyId === policy?.id && entry.vault === state?.vault);
  const typedLoss = lossInput?.policy === policyKey ? lossInput.hash : undefined;
  const lossTx = (policy?.evidence?.transaction_hash ?? state?.lossProof?.hash ?? typedLoss ?? recordedLoss?.hash ?? "").trim();
  const evidence = policy?.evidence ?? (checkedEvidence?.policy === policyKey &&
    checkedEvidence.evidence.transaction_hash === lossTx ? checkedEvidence.evidence : undefined);
  const canReview = observedClaim ? observedVerified : !policy?.mandate || !!evidence;
  const rejectEvidence = observedClaim ? observedVerified && !observedReview.verified : !!state && !!evidence && !evidenceIsCovered(state, evidence);
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
  const renewal = model?.renewal;
  const replacementSupported = typeof coverage?.migration_started === "boolean";
  const zeroSettlement = status === "Paid" && policy?.payout === "0";
  const policyStatus = status === "Paid" ? zeroSettlement ? "Settled" : "Reimbursed" : status === "CheckingEvidence" ? "Checking claim evidence"
    : status === "InReview" ? "In review" : status === "Paying" ? "Payout pending"
    : status === "Closing" ? "Releasing reserve" : status === "Rejected" ? "Claim rejected" : status === "Active" && coverage
    ? model?.coverage === "retired" ? "Retired" : model?.coverage === "ended" ? "Coverage ended" : coverage.paused ? "Paused" : coverage.active ? "Active" : "Coverage inactive"
    : status;
  const recoveryReady = !!recoveryWallet || !!state?.demoRecovery;
  const ownerReady = !!ownerWallet || !!state?.demoOwner;
  const agentKeyFormat = /^ed25519:[1-9A-HJ-NP-Za-km-z]{43,44}$/;
  const keyLooksValid = agentKeyFormat.test(publicKey.trim());
  const votes = observedClaim?.approving ?? policy?.votes ?? 0;
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
      {!hosted && ready("choose-recovery") && (
        <form className="demo-mandate" onSubmit={event => { event.preventDefault(); void walletAction("choose-recovery", "Confirm recovery account"); }}>
          <label htmlFor="checkout-recovery">Recovery account · {state.beneficiary}</label>
          <input id="checkout-recovery" value={state.pending_beneficiary ?? beneficiaryInput}
            onChange={event => setBeneficiaryInput(event.target.value)} readOnly={!!state.pending_beneficiary}
            placeholder="account.testnet" autoComplete="off" />
          <button type="submit" disabled={actionPending || !ownerReady || !(state.pending_beneficiary ?? beneficiaryInput.trim()).endsWith(".testnet")}>
            {state.pending_beneficiary ? "Retry recovery account confirmation" : "Confirm recovery account"}
          </button>
        </form>
      )}
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
    else if (!hosted && (ready("recover") || ready("recovery-claim") || ready("premium-refund") || ready("rotate-agent") || ready("resume-wallet"))) nextAction = <a href="#recovery">Go to wallet recovery</a>;
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
            <strong>{zeroSettlement ? "Claim settled without a payout" : `${near(policy.payout)} reimbursed`}</strong>
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
          <p className="eyebrow">COVERAGE</p>
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
              {renewal && (
                <div aria-live="polite">
                  <p>
                    <strong>{{
                      upcoming: "Upcoming premium", due_soon: "Renewal due soon", due: "Renewal due",
                      overdue: "Renewal overdue", pending: "Renewal confirmation pending", confirmed: "Renewal confirmed",
                    }[renewal.state]}</strong> · Period {renewal.period} · {near(renewal.amount)}
                  </p>
                  {renewal.state !== "confirmed" && <p className="demo-description">
                    Premium due by {new Date(renewal.dueAt * 1000).toLocaleString()}.
                    {["upcoming", "due_soon"].includes(renewal.state) && ` Agent payments open ${new Date(renewal.opensAt * 1000).toLocaleString()}.`}
                    {renewal.state === "overdue" && " Supplier payments are paused. A late premium covers only the rest of this period."}
                  </p>}
                  {renewal.blocker && renewal.state !== "upcoming" && <p className="demo-description">{{
                    insufficient_balance: <>The operating balance is too low. Call <code>top_up</code> on the agent wallet with the NEAR to add before retrying.</>,
                    agent_disconnected: "Connect an agent so it can pay from the operating balance.",
                    wallet_paused: "Agent spending is paused. Resume the wallet before renewing.",
                  }[renewal.blocker]}</p>}
                </div>
              )}
              {state.operatingBalance && <p className="demo-description">Operating balance · {near(state.operatingBalance)}</p>}
            </div>
          )}
          <dl className="demo-amounts">
            {!showCheckout && <div><dt>Policy premium</dt><dd>{state ? near(state.premium) : "—"}</dd></div>}
            <div><dt>Policy limit</dt><dd>{state ? near(state.limit) : "—"}</dd></div>
            {policy && coverage && !checkout && <div><dt>Available policy limit</dt>
              <dd>{status === "Paid" ? policy.payout === state.limit ? "0 NEAR · limit exhausted" : "0 NEAR · claim settled"
                : status === "Closed" ? "0 NEAR · policy closed" : near(state.limit)}</dd></div>}
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
              <p className="demo-description">{replacementSupported
                ? "Stop the agent if its credentials may be compromised. Replace the key to keep this wallet. Moving the balance to the registered recovery account permanently retires it. Eligible claims can still be filed."
                : "Stop the agent, then move the remaining operating balance to the registered recovery account. An eligible claim can still be filed."}</p>
              {state.recoveryProof && <a className="demo-proof" href={`${explorer}${state.recoveryProof.hash}/receipts`} target="_blank" rel="noreferrer">Verify wallet balance recovery ↗</a>}
              {coverage.paused && <p>{coverage.retired ? "Recovered · wallet retired" : coverage.recovery_pending ? "Recovery pending"
                : coverage.migration_started ? "Migration started · balance recovery may be retried"
                : replacementSupported && state.agent?.connected ? "Replacement agent connected · wallet paused" : "Agent access stopped"}</p>}
              <div className="demo-actions">
                {!recoveryWallet && <button type="button" disabled={!!pending} onClick={() => void connectWallet("recovery")}>Connect recovery wallet</button>}
                <button type="button" disabled={actionPending || !recoveryReady || !ready("pause")}
                  onClick={() => void walletAction("pause", "Stop agent access")}>Stop agent access</button>
                <button type="button" disabled={actionPending || !recoveryReady || !ready("recover")}
                  onClick={() => void walletAction("recover", "Recover wallet balance")}>{replacementSupported ? "Move balance and retire wallet" : "Recover wallet balance"}</button>
                {ready("resume-wallet") && <button type="button" disabled={actionPending || !recoveryReady}
                  onClick={() => void walletAction("resume-wallet", "Resume wallet")}>Resume wallet</button>}
                {ready("premium-refund") && <button type="button" disabled={actionPending || !recoveryReady}
                  onClick={() => void walletAction("premium-refund", "Refund unused premium")}>Refund unused premium</button>}
                {ready("recovery-claim") && <button type="button" disabled={actionPending || !recoveryReady}
                  onClick={() => void walletAction("recovery-claim", "File claim from recovery account")}>File claim from recovery account</button>}
              </div>
              {coverage.retired && state.wallet_code_hash && (
                replacementVault
                  ? <a href={`/demo?vault=${encodeURIComponent(replacementVault)}`}>Open replacement wallet</a>
                  : <button type="button" disabled={actionPending} onClick={() => void setupReplacement()}>Set up replacement wallet</button>
              )}
              {ready("rotate-agent") && <form onSubmit={event => { event.preventDefault(); void walletAction("rotate-agent", "Replacement agent connected"); }}>
                <p className="demo-description">Create a fresh key in the replacement runtime with <code>bun scripts/agent.ts init .agsurance-agent.key</code>. Paste the public key below. The recovery account funds {near(state.agent_funding ?? "0")} for the replacement.</p>
                <label htmlFor="replacement-public-key">Replacement agent public key</label>
                <input id="replacement-public-key" autoComplete="off" spellCheck={false} placeholder="ed25519:…" value={replacementKey}
                  onChange={event => setReplacementKey(event.target.value)} />
                <button type="submit" disabled={actionPending || !recoveryReady || !agentKeyFormat.test(replacementKey.trim())}>Connect replacement agent</button>
              </form>}
            </section>
          )}
          {state?.vendorConfirmation && (
            <p className="demo-id">Vendor {state.vendorConfirmation.vendor} confirmed {state.vendorConfirmation.new_supplier}
              {" "}until {new Date(state.vendorConfirmation.expires_at * 1000).toLocaleString()}.</p>
          )}
          <h3 id="claim-review">Claim review</h3>
          {(!hosted || recoveryPreview) && ready("submit-observed") && (
            <section className="demo-agent" aria-labelledby="observe-transfers">
              <h4 id="observe-transfers">Check finalized wallet transfers</h4>
              <button type="button" disabled={actionPending} onClick={() => void inspectObserved("watch")}>Scan recent transfers</button>
              <p className="demo-description">Recent activity comes from NearBlocks. NEAR RPC verifies the receipts.</p>
              <div className="demo-mandate">
                <label htmlFor="observed-transactions">Transaction hash and signer, one pair per line</label>
                <textarea id="observed-transactions" rows={3} value={observedRefs} onChange={event => {
                  setObservedRefs(event.target.value);
                  setObservedSelection(undefined);
                }} />
                <button type="button" disabled={actionPending || !observedRefs.trim()} onClick={() => void inspectObserved("inspect")}>Check these transfers</button>
              </div>
              {observedSelection?.policy === policyKey && (
                <div>
                  <p>{selectedTransfers.length} eligible transfer(s) · {near(observedTotal.toString())}</p>
                  {selectedTransfers.map(({ receipt, action_index }) => (
                    <p key={`${receipt.receipt_id}/${action_index}`} className="demo-id">{near(receipt.amount)} to {receipt.recipient} ·{" "}
                      <a href={`${explorer}${receipt.transaction_hash}/receipts`}>View receipt</a></p>
                  ))}
                  <button type="button" disabled={actionPending || !ownerReady || selectedTransfers.length > 8 || observedTotal <= BigInt(state?.deductible ?? "0")}
                    onClick={() => void walletAction("submit-observed", "Submit transfer evidence")}>Submit transfer evidence</button>
                </div>
              )}
            </section>
          )}
          {observedClaim && (
            <section className="demo-agent" aria-labelledby="submitted-transfers">
              <h4 id="submitted-transfers">Submitted transfer evidence</h4>
              <p className="demo-id">Evidence hash · {observedClaim.evidence_hash}</p>
              {observedClaim.transfers.map(({ receipt, action_index }) => (
                <p key={`${receipt.receipt_id}/${action_index}`} className="demo-id">{near(receipt.amount)} to {receipt.recipient} ·{" "}
                  <a href={`${explorer}${receipt.transaction_hash}/receipts`}>View receipt</a></p>
              ))}
              {status === "InReview" && <button type="button" disabled={actionPending}
                onClick={() => void inspectObserved("review")}>Verify submitted transfers</button>}
              {observedVerified && <p>{observedReview.verified ? "The finalized receipts match." : "The receipts do not match the submitted evidence."}</p>}
            </section>
          )}
          {policy?.escalated_at && (
            <p className="demo-description">
              Escalation recorded {new Date(policy.escalated_at * 1000).toLocaleString()}.
              {status === "InReview" && " The claim stays open and its reserve remains locked while the panel reviews it."}
            </p>
          )}
          {status === "InReview" && reviewDeadline && !policy?.escalated_at &&
            <p className="demo-description">Panel review deadline · {new Date(reviewDeadline * 1000).toLocaleString()}</p>}
          <dl className="demo-amounts">
            <div><dt>Recorded loss</dt><dd>{observedClaim && policy ? near(policy.loss) : incident ? near(incident.amount) : "—"}</dd></div>
            <div><dt>Deductible</dt><dd>{state ? near(state.deductible) : "—"}</dd></div>
            <div><dt>Approvals</dt><dd>{voteCount} / 2 required</dd></div>
            <div className={status === "Paid" && !zeroSettlement ? "demo-reimbursed" : ""}>
              <dt>{status === "Paid" && !zeroSettlement ? "Reimbursed" : "Claim payout"}</dt>
              <dd>{policy && (policy.payout !== "0" || zeroSettlement) ? near(policy.payout) : "—"}</dd>
            </div>
          </dl>
          {!observedClaim && policy?.mandate && status === "InReview" && (
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
          {(!hosted || recoveryPreview) && claimRecovery && policy && !["Active", "CheckingEvidence"].includes(policy.phase) && (
            <section className="demo-agent" aria-labelledby="claim-recovery">
              <h3 id="claim-recovery">Recovered claim funds</h3>
              <dl className="demo-amounts">
                <div><dt>Recovered before payout</dt><dd>{near(claimRecovery.recovered_before_payout)}</dd></div>
                <div><dt>Recovered after payout</dt><dd>{near(claimRecovery.recovered_after_payout)}</dd></div>
                {claimRecovery.recovered_after_payout !== "0" && <>
                  <div><dt>Allocated for loss above the limit</dt><dd>{near(claimRecovery.beneficiary_over_limit)}</dd></div>
                  <div><dt>Allocated to reimburse the reserve</dt><dd>{near(claimRecovery.reserve_reimbursement)}</dd></div>
                  <div><dt>Allocated to return the deductible</dt><dd>{near(claimRecovery.beneficiary_deductible)}</dd></div>
                </>}
                <div><dt>Owed to recovery account</dt><dd>{near(claimRecovery.beneficiary_claimable)}</dd></div>
                <div><dt>Owed to reserve</dt><dd>{near(claimRecovery.reserve_claimable)}</dd></div>
              </dl>
              {ready("record-claim-recovery") && (!hosted || (claimRecovery.recovered_before_payout === "0" && policy.phase !== "Paid")) && (
                <form onSubmit={event => { event.preventDefault(); void walletAction("record-claim-recovery", "Recovered claim funds recorded"); }}>
                  <p className="demo-description">{status === "Paid" ? "Deposit NEAR recovered from this incident after recovery costs to split it under the claim’s recovery rules."
                    : "Deposit NEAR recovered from this incident after recovery costs to reduce the remaining claim payout."} Maximum: {near(outstandingLoss.toString())}.</p>
                  <label htmlFor="recovered-near">Recovered amount to send (NEAR)</label>
                  <input id="recovered-near" readOnly={hosted} inputMode="decimal" value={recoveryInput}
                    onChange={event => setRecoveredNear({ policy: policyKey, amount: event.target.value })} />
                  <button type="submit" disabled={actionPending || !recoveryReady || !canReportRecovery}>Send recovered funds</button>
                  {!recoveryReady && <button type="button" disabled={!!pending} onClick={() => void connectWallet("recovery")}>Connect recovery wallet</button>}
                </form>
              )}
              {status === "Paying" && <p className="demo-description">Wait for payout confirmation before sending recovered funds.</p>}
              <div className="demo-actions">
                {(["Beneficiary", "Reserve"] as const).map(recipient => {
                  const [credit, pendingAmount, name] = recipient === "Beneficiary"
                    ? [claimRecovery.beneficiary_claimable, claimRecovery.beneficiary_pending, "recovery account"]
                    : [claimRecovery.reserve_claimable, claimRecovery.reserve_pending, "reserve"];
                  return pendingAmount !== "0" ? <span key={recipient}>{near(pendingAmount)} transfer to {name} pending</span>
                    : credit !== "0" ? <button key={recipient} type="button" disabled={actionPending || !ready("distribute-claim-recovery")}
                      onClick={() => void run("distribute-claim-recovery", `Send recovery to ${name}`, { recipient })}>Send {near(credit)} to {name}</button> : null;
                })}
              </div>
            </section>
          )}
          {ready("pay") && <a className="demo-proof" href="#policy-overview">Go to payout ↗</a>}
          {state && <p className="demo-id">Recovery account · {state.beneficiary}</p>}
          {state && policy && !["Active", "CheckingEvidence"].includes(policy.phase) &&
            <p className="demo-id">Claim ID · {state.vault}/{policy.id}</p>}
        </section>
        <section className="demo-panel" aria-labelledby="agent-console">
          <p className="eyebrow">RUNNER</p>
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
