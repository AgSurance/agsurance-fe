export type Phase = "Active" | "CheckingEvidence" | "InReview" | "Approved" | "Paying" | "Paid";
export type Policy = { id: number; phase: Phase; votes: number; loss: string; payout: string };
export type Incident = { policy_id: number; amount: string; recipient: string; block_height: number };
export type Dashboard = {
  reserve: string; reserved: string; premium: string; limit: string; deductible: string;
  policy: Policy | null; beneficiary: string;
};
export type DemoState = Dashboard & { incident: Incident | null; wallet: string; vault: string; runner: string };
export type Step = "buy" | "loss" | "submit" | "review1" | "review2" | "pay";
export type Activity = { label: string; actor: string; hash: string; receipt?: string };
