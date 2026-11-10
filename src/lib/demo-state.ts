export const CHECKOUT_GAS = "120000000000000";
export const TESTNET_RPC = "https://test.rpc.fastnear.com";

export type Phase = "Active" | "CheckingEvidence" | "InReview" | "Approved" | "Paying" | "Paid";
export type Mandate = { supplier: string; limit: string };
export type Evidence = {
  transaction_hash: string; receipt_id: string; block_height: number; recipient: string; amount: string;
};
export type Policy = {
  id: number; phase: Phase; votes: number; loss: string; payout: string; activation_height?: number;
  review_deadline?: number | null; escalated_at?: number | null;
  windows?: (number | null)[];
  mandate?: Mandate; incident?: Incident | null; evidence?: Evidence | null;
};
export type Incident = { policy_id: number; amount: string; recipient: string; block_height: number };
export type Agent = { account_id: string; public_key: string; connected: boolean };
export type Coverage = {
  active: boolean; current_window: number | null; payable_window: number | null; next_boundary: number | null;
  renewal_pending: boolean; paused: boolean; recovery_pending: boolean; retired: boolean; unused_premium: boolean;
};
export type ReserveStatus = {
  assets: string; locked: string; available: string; shortfall: string; pending: string; quarantined: string;
};
export type Dashboard = {
  reserve?: string; reserve_pool?: string; reserved: string; premium: string; limit: string; deductible: string;
  policy: Policy | null; beneficiary: string;
  coverage?: Coverage;
  owner?: string; agent?: Agent | null; agent_funding?: string;
  wallet_funding?: string; max_supplier_limit?: string;
  checkout?: { policy_id: number; phase: "Booking" | "Funding" | "Releasing" | "ReleaseAvailable" | "Refunding" | "RefundAvailable" } | null;
};
export type DemoState = Dashboard & { incident: Incident | null; wallet: string; vault: string; runner: string; suggestedSupplier?: string; demoOwner: boolean; demoRecovery?: boolean; operatingBalance?: string; payoutProof?: Activity; recoveryProof?: Activity; reserveStatus?: ReserveStatus };
export type Step = "buy" | "loss" | "submit" | "review1" | "review2" | "review3" | "pay" | "connect" | "revoke" | "refund" | "pause" | "recover" | "premium-refund" | "recovery-claim" | "escalate";
export type Activity = { label: string; actor: string; hash: string; receipt?: string; policyId?: number; vault?: string };

export function checkoutTotal(state: Pick<Dashboard, "premium" | "wallet_funding">) {
  return (BigInt(state.premium) + BigInt(state.wallet_funding ?? "0")).toString();
}


export function parseNear(value: string) {
  if (!/^\d{1,8}(\.\d{1,24})?$/.test(value)) return undefined;
  const [whole, fractional = ""] = value.split(".");
  return (BigInt(whole) * (BigInt(10) ** BigInt(24)) + BigInt(fractional.padEnd(24, "0"))).toString();
}
