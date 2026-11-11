import { parseNear } from "./demo-state";

const oneNear = BigInt(10) ** BigInt(24);

export function formatNear(amount: string | bigint) {
  const digits = String(amount).padStart(25, "0");
  const fraction = digits.slice(-24).replace(/0+$/, "");
  return `${digits.slice(0, -24)}${fraction ? `.${fraction}` : ""} NEAR`;
}

export const coverageScenarios = {
  lower: { label: "Lower claim scenario", rate: BigInt(1620) },
  middle: { label: "Middle claim scenario", rate: BigInt(2334) },
  higher: { label: "Higher premium scenario", rate: BigInt(5000) },
} as const;

export function fullBalanceEstimate(input: string, scenario: keyof typeof coverageScenarios = "middle") {
  const value = parseNear(input);
  if (!value || value === "0") return null;
  const limit = BigInt(value);
  // 1.62%, 2.334%, and 5% for a 28-day example.
  const scale = BigInt(100_000);
  const premium = (limit * coverageScenarios[scenario].rate + scale - BigInt(1)) / scale;
  return { limit, premium, total: limit + premium };
}

export const testnetPremium = (limit: bigint) => (limit + BigInt(39)) / BigInt(40);
export const minPolicyLimit = BigInt(10) ** BigInt(21);

export function nearNumber(amount: string) {
  return Number(BigInt(amount)) / Number(oneNear);
}
