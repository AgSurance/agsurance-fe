export const TESTNET_RPC = "https://test.rpc.fastnear.com";

export type Phase = "Active" | "CheckingEvidence" | "InReview" | "Approved" | "Paying" | "Paid";
export type Mandate = { supplier: string; limit: string };
export type Evidence = {
  transaction_hash: string; receipt_id: string; block_height: number; recipient: string; amount: string;
};
export type Policy = {
  id: number; phase: Phase; votes: number; loss: string; payout: string; activation_height?: number;
  mandate?: Mandate; incident?: Incident | null; evidence?: Evidence | null;
};
export type Incident = { policy_id: number; amount: string; recipient: string; block_height: number };
export type Agent = { account_id: string; public_key: string; connected: boolean };
export type Dashboard = {
  reserve: string; reserved: string; premium: string; limit: string; deductible: string;
  policy: Policy | null; beneficiary: string;
  owner?: string; agent?: Agent | null; agent_funding?: string;
  wallet_funding?: string; max_supplier_limit?: string;
  checkout?: { policy_id: number; phase: "Funding" | "Refunding" | "RefundAvailable" } | null;
};
export type DemoState = Dashboard & { incident: Incident | null; wallet: string; vault: string; runner: string; suggestedSupplier?: string; demoOwner: boolean; payoutProof?: Activity };
export type Step = "buy" | "loss" | "submit" | "review1" | "review2" | "pay" | "connect" | "revoke" | "refund";
export type Activity = { label: string; actor: string; hash: string; receipt?: string; policyId?: number; vault?: string };

export function checkoutTotal(state: Pick<Dashboard, "premium" | "wallet_funding">) {
  return (BigInt(state.premium) + BigInt(state.wallet_funding ?? "0")).toString();
}


export function parseNear(value: string) {
  if (!/^\d{1,8}(\.\d{1,24})?$/.test(value)) return undefined;
  const [whole, fractional = ""] = value.split(".");
  return (BigInt(whole) * (BigInt(10) ** BigInt(24)) + BigInt(fractional.padEnd(24, "0"))).toString();
}
