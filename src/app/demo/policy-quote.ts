import { minPolicyLimit, testnetPremium } from "../../lib/coverage-estimate";
import { parseNear, type DemoState } from "../../lib/demo-state";
import type { PoolCapacity } from "../../lib/manual-demo";

const zero = BigInt(0);
const min = (a: bigint, b: bigint) => a < b ? a : b;
const positive = (value: bigint) => value > zero ? value : zero;

export function policyQuote(
  dashboard: DemoState,
  capacity: PoolCapacity,
  mode: "buy" | "increase",
  fundingInput: string,
  limitInput: string,
) {
  const fundingValue = mode === "buy" ? parseNear(fundingInput) : "0";
  const funding = BigInt(fundingValue ?? "0");
  const balance = BigInt(dashboard.operatingBalance ?? "0") + funding;
  const deductible = BigInt(dashboard.deductible);
  const existing = mode === "increase" ? BigInt(dashboard.limit) : zero;
  const recommended = positive(balance - deductible);
  const room = capacity.issuing ? min(BigInt(capacity.liquid_available), BigInt(capacity.group_remaining)) : zero;
  const maximum = min(recommended, min(BigInt(capacity.limits.max_policy), room + existing));
  const input = parseNear(limitInput);
  const chosen = limitInput.trim() === "" ? maximum : BigInt(input ?? "0");
  const premium = testnetPremium(chosen);
  const window = dashboard.coverage?.current_window;
  const prepaid = window == null ? 0 : dashboard.policy?.windows?.slice(window).filter(value => value != null).length ?? 0;
  const addedFee = positive(premium - BigInt(dashboard.premium)) * BigInt(prepaid);
  const valid = fundingValue !== undefined && chosen >= minPolicyLimit && chosen > existing && chosen <= maximum;
  return { funding, balance, deductible, existing, recommended, maximum, chosen, premium, addedFee,
    uncovered: positive(balance - chosen), valid };
}
