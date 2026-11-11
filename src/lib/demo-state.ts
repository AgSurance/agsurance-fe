export const CHECKOUT_GAS = "120000000000000";
export const TESTNET_RPC = "https://test.rpc.fastnear.com";

export type Phase = "Active" | "CheckingEvidence" | "InReview" | "Approved" | "Paying" | "Paid" | "Rejected" | "Closing" | "Closed";
export type Mandate = { supplier: string; limit: string };
export type Evidence = {
  transaction_hash: string; receipt_id: string; block_height: number; recipient: string; amount: string;
  block_timestamp_ms?: number;
};
export type Policy = {
  id: number; phase: Phase; votes: number; loss: string; payout: string; activation_height?: number;
  review_deadline?: number | null; escalated_at?: number | null;
  windows?: (number | null)[];
  mandate?: Mandate; incident?: Incident | null; evidence?: Evidence | null;
};
export type Incident = { policy_id: number; amount: string; recipient: string; block_height: number };
export type Agent = { account_id: string; public_key: string; connected: boolean };
export type ClaimRecovery = {
  recovered_before_payout: string; recovered_after_payout: string;
  beneficiary_claimable: string; reserve_claimable: string; beneficiary_pending: string; reserve_pending: string;
  beneficiary_over_limit: string; beneficiary_deductible: string; reserve_reimbursement: string;
};
export type RecoveryRecipient = "Beneficiary" | "Reserve";
export type Coverage = {
  active: boolean; current_window: number | null; payable_window: number | null; next_boundary: number | null;
  renewal_pending: boolean; paused: boolean; recovery_pending: boolean; retired: boolean; unused_premium: boolean;
  migration_started?: boolean; filing_deadline?: number | null; retired_at_ms?: number | null; window_seconds?: number;
};
export type ReserveStatus = {
  assets: string; locked: string; available: string; shortfall: string; pending: string; quarantined: string;
};
export type Dashboard = {
  reserve?: string; reserve_pool?: string; reserved: string; premium: string; limit: string; deductible: string;
  policy: Policy | null; beneficiary: string;
  coverage?: Coverage; claim_recovery?: ClaimRecovery | null;
  owner?: string; agent?: Agent | null; agent_funding?: string;
  wallet_funding?: string; max_supplier_limit?: string;
  checkout?: { policy_id: number; phase: "Booking" | "Funding" | "Releasing" | "ReleaseAvailable" | "Refunding" | "RefundAvailable" } | null;
  chain_time?: number; wallet?: string;
};
export type DemoState = Dashboard & { incident: Incident | null; wallet: string; vault: string; runner: string; suggestedSupplier?: string; demoOwner: boolean; demoRecovery?: boolean; operatingBalance?: string; payoutProof?: Activity; lossProof?: Activity; recoveryProof?: Activity; reserveStatus?: ReserveStatus; status?: AppStatus; blockHeight?: number };
export type Step = "buy" | "loss" | "submit" | "review1" | "review2" | "review3" | "pay" | "connect" | "revoke" | "refund" | "pause" | "recover" | "premium-refund" | "recovery-claim" | "rotate-agent" | "resume-wallet" | "record-claim-recovery" | "distribute-claim-recovery" | "escalate" | "close";
export type Activity = { label: string; actor: string; hash: string; receipt?: string; policyId?: number; vault?: string };
export type TransactionReference = { transactionHash: string; signerId: string };
type Action = Step | "pay-supplier" | "renew" | "agent-claim";
type Availability = "available" | "policy_state" | "pending" | "no_incident" | "filing_closed" | "window_open" | "coverage_inactive" | "wallet_paused" | "reserve_shortfall" | "no_capacity" | "agent_disconnected" | "no_premium_due" | "already_voted" | "review_deadline_open";
type StatusInput = Dashboard & { incident?: Incident | null; reserveStatus?: ReserveStatus; operatingBalance?: string };
export type Renewal = {
  state: "upcoming" | "due_soon" | "due" | "overdue" | "pending" | "confirmed";
  period: number; amount: string; dueAt: number; opensAt: number;
  blocker: "wallet_paused" | "agent_disconnected" | "insufficient_balance" | null;
};
export type AppStatus = {
  policyId: number | null;
  checkoutPolicyId: number | null;
  phase: Phase | null;
  coverage: "unknown" | "none" | "active" | "lapsed" | "ended" | "retired";
  filingDeadline: number | null;
  renewal: Renewal | null;
  actions: Record<Action, Availability>;
  pendingTransaction: TransactionReference | null;
};

function projectRenewal(state: StatusInput, chainTime: number): Renewal | null {
  const { coverage, policy, operatingBalance } = state;
  if (!coverage || !policy?.windows || policy.phase !== "Active" || coverage.retired ||
      coverage.current_window == null || coverage.next_boundary == null || !coverage.window_seconds) return null;
  const current = coverage.current_window;
  const target = coverage.active ? current + 1 : current;
  if (target >= policy.windows.length) return null;
  const lead = Math.floor(coverage.window_seconds / 7);
  const dueAt = coverage.next_boundary - (target === current ? coverage.window_seconds : 0);
  const opensAt = dueAt - lead;
  const confirmed = policy.windows[target] != null;
  const renewalState = confirmed ? "confirmed" : coverage.renewal_pending ? "pending"
    : !coverage.active ? "overdue" : chainTime >= opensAt ? "due"
    : chainTime >= opensAt - lead ? "due_soon" : "upcoming";
  const blocker = confirmed || coverage.renewal_pending ? null : coverage.paused ? "wallet_paused"
    : !state.agent?.connected ? "agent_disconnected" : operatingBalance != null && BigInt(operatingBalance) < BigInt(state.premium)
      ? "insufficient_balance" : null;
  return { state: renewalState, period: target + 1, amount: state.premium, dueAt, opensAt, blocker };
}

export function projectStatus(
  state: StatusInput,
  pendingTransaction: TransactionReference | null = null,
  allowOwnerClaim = false,
): AppStatus {
  const { policy, coverage, checkout, agent, reserveStatus, incident } = state;
  const phase = policy?.phase ?? null;
  const active = phase === "Active";
  const hasLoss = !!policy && incident?.policy_id === policy.id;
  const chainTime = state.chain_time ?? Math.floor(Date.now() / 1000);
  const filingDeadline = coverage?.filing_deadline ?? null;
  const filingClosed = filingDeadline !== null && chainTime >= filingDeadline;
  const shortfall = !!reserveStatus && BigInt(reserveStatus.shortfall) > BigInt(0);
  const capacityFull = !!reserveStatus && BigInt(reserveStatus.available) < BigInt(state.limit);
  const connecting = !!agent && !agent.connected;
  const buying = !policy || phase === "Paid" || phase === "Closed";
  const claim = !active ? "policy_state" : filingClosed ? "filing_closed" : !hasLoss ? "no_incident" : "available";
  const agentReady = agent?.connected ? "available" : "agent_disconnected";
  const review = (mask: number) => policy?.phase !== "InReview" ? "policy_state" : (policy.votes & mask) ? "already_voted" : "available";

  const replaceable = !!policy && coverage?.migration_started === false && coverage.paused && !coverage.retired;
  const recovery = state.claim_recovery;
  const remainingLoss = recovery && policy
    ? BigInt(policy.loss) - BigInt(recovery.recovered_before_payout) - BigInt(recovery.recovered_after_payout) : BigInt(0);

  return {
    policyId: policy?.id ?? null, checkoutPolicyId: checkout?.policy_id ?? null, phase, filingDeadline,
    coverage: !policy ? "none" : !coverage ? "unknown" : coverage.retired ? "retired"
      : phase === "Paid" || phase === "Closed" || coverage.current_window == null ? "ended" : coverage.active ? "active" : "lapsed",
    renewal: projectRenewal(state, chainTime),
    pendingTransaction,
    actions: {
      buy: checkout || connecting || coverage?.renewal_pending ? "pending" : coverage?.paused ? "wallet_paused"
        : !buying ? "policy_state" : shortfall ? "reserve_shortfall" : capacityFull ? "no_capacity" : "available",
      refund: checkout?.phase === "RefundAvailable" || checkout?.phase === "ReleaseAvailable" ? "available" : "policy_state",
      close: !filingDeadline || !["Active", "Rejected", "Closing"].includes(phase ?? "") ? "policy_state"
        : !filingClosed ? "window_open" : checkout || coverage?.renewal_pending ? "pending" : "available",
      connect: !state.agent_funding || !active || !!agent ? "policy_state" : coverage?.paused ? "wallet_paused" : "available",
      revoke: agentReady,
      pause: !coverage || !policy ? "policy_state" : checkout || connecting ? "pending" : coverage.paused ? "wallet_paused" : "available",
      recover: !coverage?.paused || coverage.retired ? "policy_state" : coverage.recovery_pending || coverage.renewal_pending ? "pending" : "available",
      "premium-refund": coverage?.unused_premium ? "available" : "policy_state",
      "recovery-claim": coverage?.paused ? claim : "policy_state",
      "rotate-agent": !replaceable || !state.agent_funding || agent?.connected ? "policy_state"
        : checkout || coverage?.recovery_pending || connecting ? "pending" : "available",
      "resume-wallet": !replaceable || !agent?.connected ? "policy_state"
        : checkout || coverage?.recovery_pending || coverage?.renewal_pending ? "pending" : "available",
      "record-claim-recovery": recovery && ["InReview", "Approved", "Paid"].includes(phase ?? "") && remainingLoss > BigInt(0)
        ? "available" : phase === "Paying" ? "pending" : "policy_state",
      "distribute-claim-recovery": recovery && (BigInt(recovery.beneficiary_claimable) > BigInt(0) && BigInt(recovery.beneficiary_pending) === BigInt(0)
        || BigInt(recovery.reserve_claimable) > BigInt(0) && BigInt(recovery.reserve_pending) === BigInt(0)) ? "available" : "policy_state",
      loss: !active || hasLoss ? "policy_state" : coverage?.paused ? "wallet_paused" : coverage && !coverage.active ? "coverage_inactive" : "available",
      submit: !state.owner || allowOwnerClaim ? claim : "policy_state",
      review1: review(1), review2: review(2), review3: review(4),
      escalate: phase !== "InReview" || !policy?.review_deadline || policy.escalated_at ? "policy_state"
        : chainTime < policy.review_deadline ? "review_deadline_open" : "available",
      pay: phase === "Paying" && !!reserveStatus ? "available" : phase !== "Approved" ? "policy_state" : shortfall ? "reserve_shortfall" : "available",
      "pay-supplier": !active ? "policy_state" : agentReady !== "available" ? agentReady : coverage?.paused ? "wallet_paused"
        : coverage && !coverage.active ? "coverage_inactive" : hasLoss ? "policy_state" : "available",
      renew: !active || !coverage ? "policy_state" : agentReady !== "available" ? agentReady : coverage.paused ? "wallet_paused"
        : coverage.renewal_pending ? "pending" : coverage.payable_window == null ? "no_premium_due" : "available",
      "agent-claim": agentReady !== "available" ? agentReady : incident === undefined && active && !filingClosed ? "available" : claim,
    },
  };
}

export function evidenceIsCovered(state: Dashboard, evidence: Evidence) {
  const policy = state.policy;
  const seconds = state.coverage?.window_seconds;
  if (!seconds) return true;
  const first = policy?.windows?.[0];
  const timestamp = evidence.block_timestamp_ms;
  if (first == null || timestamp == null || policy?.activation_height == null) return false;
  const time = Math.floor(timestamp / 1000);
  const index = Math.floor((time - first) / seconds);
  const start = policy.windows?.[index];
  return start != null && start <= time && evidence.block_height >= policy.activation_height
    && (state.coverage?.retired_at_ms == null || timestamp < state.coverage.retired_at_ms);
}

export function checkoutTotal(state: Pick<Dashboard, "premium" | "wallet_funding">) {
  return (BigInt(state.premium) + BigInt(state.wallet_funding ?? "0")).toString();
}
export function parseNear(value: string) {
  if (!/^\d{1,8}(\.\d{1,24})?$/.test(value)) return undefined;
  const [whole, fractional = ""] = value.split(".");
  return (BigInt(whole) * (BigInt(10) ** BigInt(24)) + BigInt(fractional.padEnd(24, "0"))).toString();
}
