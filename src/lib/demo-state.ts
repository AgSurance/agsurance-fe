export const TESTNET_RPC = "https://test.rpc.fastnear.com";

export type Phase = "Active" | "CheckingEvidence" | "InReview" | "Approved" | "Paying" | "Paid";
export type Policy = { id: number; phase: Phase; votes: number; loss: string; payout: string };
export type Incident = { policy_id: number; amount: string; recipient: string; block_height: number };
export type Agent = { account_id: string; public_key: string; connected: boolean };
export type Dashboard = {
  reserve: string; reserved: string; premium: string; limit: string; deductible: string;
  policy: Policy | null; beneficiary: string;
  owner?: string; agent?: Agent | null; agent_funding?: string;
  wallet_funding?: string;
  checkout?: { policy_id: number; phase: "Funding" | "Refunding" | "RefundAvailable" } | null;
};
export type DemoState = Dashboard & { incident: Incident | null; wallet: string; vault: string; runner: string; demoOwner: boolean; payoutProof?: Activity };
export type Step = "buy" | "loss" | "submit" | "review1" | "review2" | "pay" | "connect" | "revoke" | "refund";
export type Activity = { label: string; actor: string; hash: string; receipt?: string };

export function checkoutTotal(state: Pick<Dashboard, "premium" | "wallet_funding">) {
  return (BigInt(state.premium) + BigInt(state.wallet_funding ?? "0")).toString();
}
