"use client";

import { useState } from "react";
import { formatNear, nearNumber } from "../../lib/coverage-estimate";
import { parseNear, type ReserveStatus } from "../../lib/demo-state";
import type { CapitalStatus } from "../../lib/manual-demo";

const percent = new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits: 2 });
const milliNear = BigInt(10) ** BigInt(21);
const termYears = 28 / 365;

export function CapitalProvider({ capital, pool, reserve, busy, onDeposit }: {
  capital?: CapitalStatus | null; pool?: string; reserve?: ReserveStatus; busy: boolean; onDeposit: (amount: string) => void;
}) {
  const [deposit, setDeposit] = useState("1");
  const [premiums, setPremiums] = useState("0.04");
  const [claims, setClaims] = useState("0");
  const [staking, setStaking] = useState("0");

  const units = parseNear(deposit);
  const validDeposit = !!units && BigInt(units) >= milliNear && BigInt(units) % milliNear === BigInt(0);
  const funded = capital ? nearNumber(capital.pool_equity ?? capital.capital_raised) : 0;
  const contribution = units ? nearNumber(units) : 0;
  const cohort = funded + contribution;
  const surplus = capital ? Math.min(nearNumber(capital.delegation_cap), Math.max(0, nearNumber(capital.liquid_surplus) + contribution - nearNumber(capital.liquidity_gap))) : 0;
  const validAssumptions = [premiums, claims].every(amount => parseNear(amount) !== undefined)
    && staking.trim() !== "" && Number(staking) >= 0 && Number(staking) <= 100;
  const periodStaking = (1 + Number(staking) / 100) ** termYears - 1;
  const net = Number(premiums) * 0.8 * 0.7 - Number(claims) + surplus * periodStaking;
  const periodNet = new Intl.NumberFormat("en", { maximumFractionDigits: 6 });
  const apy = cohort > 0 && validAssumptions ? Math.max(0, 1 + net / cohort) ** (1 / termYears) - 1 : NaN;
  const accepting = capital?.accepting_deposits ?? (!!capital && !capital.sealed && !capital.closed);
  const room = capital && BigInt(capital.capital_raised) + BigInt(units ?? "0") <= BigInt(100_000) * BigInt(10) ** BigInt(24);

  return (
    <div className="demo-manual-flow">
      <h3>{capital?.rolling ? "Fund the shared claim reserve" : "Fund the capital pilot"}</h3>
      <p>{capital?.rolling
        ? "Your deposit can increase checkout capacity. You receive a share of the pool at its current value and take on its existing claim obligations."
        : "This testnet capital cohort has its own reserve."} Providers share eligible premium revenue and staking rewards on surplus. Paid claims can reduce the capital you get back.</p>
      <div className="demo-manual-fields">
        <label>Capital to deposit (NEAR)
          <input inputMode="decimal" maxLength={29} value={deposit} onChange={event => setDeposit(event.target.value)} />
        </label>
        <label>Expected premiums per 28 days (NEAR)
          <input inputMode="decimal" maxLength={29} value={premiums} onChange={event => setPremiums(event.target.value)} />
        </label>
        <label>Expected claims per 28 days (NEAR)
          <input inputMode="decimal" maxLength={29} value={claims} onChange={event => setClaims(event.target.value)} />
        </label>
        <label>Assumed validator APY (%)
          <input inputMode="decimal" maxLength={7} value={staking} onChange={event => setStaking(event.target.value)} />
        </label>
      </div>
      <dl className="demo-amounts demo-manual-amounts" aria-live="polite">
        <div><dt>Projected annual yield (APY)</dt><dd>{Number.isFinite(apy) ? percent.format(apy) : "—"}</dd></div>
        <div><dt>Projected pool result per 28 days</dt><dd>{validAssumptions ? periodNet.format(net) + " NEAR" : "—"}</dd></div>
        <div><dt>Capital already in this cohort</dt><dd>{capital ? formatNear(capital.capital_raised) : "—"}</dd></div>
        <div><dt>Your confirmed deposits</dt><dd>{capital ? formatNear(capital.account_share?.principal_contributed ?? "0") : "—"}</dd></div>
        {capital?.rolling && <>
          <div><dt>Current pool equity</dt><dd>{formatNear(capital.pool_equity ?? "0")}</dd></div>
          <div><dt>Your current pool share value</dt><dd>{formatNear(capital.account_share?.equity ?? "0")}</dd></div>
          {reserve && <>
            <div><dt>Allocated to claims</dt><dd>{formatNear(reserve.locked)}</dd></div>
            <div><dt>Liquid capacity before policy and group caps</dt><dd>{formatNear(reserve.available)}</dd></div>
          </>}
          <div><dt>Liquidity buffer</dt><dd>{formatNear(capital.buffer ?? "0")}</dd></div>
          <div><dt>Eligible staking surplus now</dt><dd>{formatNear(BigInt(capital.liquid_surplus) < BigInt(capital.delegation_cap) ? capital.liquid_surplus : capital.delegation_cap)}</dd></div>
        </>}
      </dl>
      <p className="demo-description">The estimate repeats and compounds a 28-day scenario. It assumes 20% cashback and a 70% provider share of the remaining premium. Only eligible surplus earns the assumed staking yield. Actual returns depend on claims, premiums, and staking.</p>
      {capital && !capital.closed && !accepting && <p>{capital.rolling
        ? "Deposits are paused while the reserve reconciles payouts or staking."
        : "This cohort is sealed. Deposits reopen with a new cohort."}</p>}
      {capital?.closed && <p>The cohort is closed.</p>}
      {(!pool || !capital) && <p>The testnet capital pool is currently unavailable.</p>}
      {!validDeposit && <p>Enter a deposit in increments of 0.001 NEAR.</p>}
      {capital && !room && <p>This deposit would exceed the cohort cap.</p>}
      <button type="button" disabled={busy || !pool || !capital || !accepting || !validDeposit || !room}
        onClick={() => { if (units) onDeposit(units); }}>Deposit from wallet</button>
    </div>
  );
}
