import { formatNear } from "../lib/coverage-estimate";
import { view } from "../lib/demo-near";
import type { ReserveStatus } from "../lib/demo-state";
import { manualDemoContracts, type CapitalStatus } from "../lib/manual-demo";

export async function ReserveOverview() {
  const { factory, capitalPool } = manualDemoContracts();
  if (!factory && !capitalPool) return <p>Reserve figures are available in the configured testnet demo.</p>;

  const signal = AbortSignal.timeout(4000);
  const config = factory ? await view<[string, string] | null>(factory, "pool_config", {}, undefined, signal).catch(() => null) : null;
  const pool = config?.[0] ?? capitalPool;
  if (!pool) return <p>Reserve figures are temporarily unavailable on NEAR testnet.</p>;

  const snapshot = await Promise.all([
    view<ReserveStatus>(pool, "reserve_status", {}, undefined, signal),
    view<CapitalStatus | null>(pool, "capital_status", { account_id: null }, undefined, signal).catch(() => null),
  ]).catch(() => null);
  if (!snapshot) return <p>Reserve figures are temporarily unavailable on NEAR testnet.</p>;

  const [reserve, capital] = snapshot;
  const figures = [
    { label: "Liquid reserve assets", amount: reserve.assets },
    { label: "Set aside for policies", amount: reserve.locked },
    { label: "Available after allocations and buffer", amount: reserve.available },
    { label: "Principal delegated to staking", amount: capital?.principal_delegated },
  ];

  return (
    <div className="reserve-snapshot">
      <p className="eyebrow">LIVE · NEAR TESTNET</p>
      <p className="reserve-account">Reserve contract <a href={`https://testnet.nearblocks.io/address/${pool}`}>{pool}</a></p>
      <dl className="reserve-figures">
        {figures.map(({ label, amount }) => amount === undefined ? null : (
          <div key={label}><dt>{label}</dt><dd>{formatNear(amount)}</dd></div>
        ))}
      </dl>
      <p className="landing-note">The contract does not publish aggregate counts of policyholders or capital providers.</p>
    </div>
  );
}
