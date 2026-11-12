import type { DemoState, ReserveStatus } from "./demo-state";

export type ManualSetup = { wallet: string; vault: string; stage: "Wallet" | "Vault" | "Register" | "Ready"; pending: boolean };

export type CapitalStatus = {
  capital_raised: string; liquid_surplus: string; liquidity_gap: string; delegation_cap: string;
  sealed: boolean; closed: boolean; validator: string;
  rolling?: boolean; accepting_deposits?: boolean; buffer?: string;
  pool_equity?: string; claims_paid?: string; premium_income?: string; staking_income?: string; principal_delegated?: string;
  account_share: { principal_contributed: string; equity?: string } | null;
};

export type PoolCapacity = {
  limits: { max_policy: string; max_group: string };
  group_remaining: string; liquid_available: string; issuing: boolean; buffer: string;
};

export type ManualSnapshot = {
  fundingPool?: string;
  poolCapacity?: PoolCapacity;
  poolReserve?: ReserveStatus;
  setupDeposit?: string;
  setup?: ManualSetup | null;
  dashboard?: DemoState;
  capital?: CapitalStatus | null;
  errors: string[];
};

export function manualDemoContracts() {
  return {
    factory: process.env.AGSURANCE_MANUAL_FACTORY,
    capitalPool: process.env.AGSURANCE_MANUAL_CAPITAL_POOL,
    supplier: process.env.AGSURANCE_MANUAL_SUPPLIER,
  };
}
