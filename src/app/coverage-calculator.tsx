"use client";

import { useState } from "react";
import { coverageScenarios, formatNear, fullBalanceEstimate } from "../lib/coverage-estimate";
import styles from "./coverage-economics.module.css";

export function CoverageCalculator() {
  const [balance, setBalance] = useState("1000");
  const [scenario, setScenario] = useState<keyof typeof coverageScenarios>("middle");
  const [fundWallet, setFundWallet] = useState(false);
  const estimate = fullBalanceEstimate(balance, scenario);

  return (
    <article className={styles.calculator} aria-labelledby="full-balance-title">
      <h3 id="full-balance-title">Full-balance coverage calculator</h3>
      <label htmlFor="agent-funding-estimate">Agent wallet balance to cover (NEAR)</label>
      <input id="agent-funding-estimate" inputMode="decimal" maxLength={29} value={balance}
        onChange={event => setBalance(event.target.value)} aria-describedby="estimate-terms" />
      <label htmlFor="claim-scenario">Pricing scenario</label>
      <select id="claim-scenario" value={scenario} onChange={event => setScenario(event.target.value as typeof scenario)}>
        {Object.entries(coverageScenarios).map(([key, option]) => <option key={key} value={key}>{option.label}</option>)}
      </select>
      <label><input type="checkbox" checked={fundWallet} onChange={event => setFundWallet(event.target.checked)} /> I also need to fund this wallet</label>
      <div aria-live="polite">
        {estimate ? <dl className={styles.rows}>
          <div><dt>Recommended coverage limit</dt><dd>{formatNear(estimate.limit)}</dd></div>
          <div><dt>Estimated premium for 28 days</dt><dd>{formatNear(estimate.premium)}</dd></div>
          {fundWallet && <div><dt>Wallet funding plus premium, before gas</dt><dd>{formatNear(estimate.total)}</dd></div>}
        </dl> : <p>Enter a positive NEAR amount.</p>}
      </div>
      <p id="estimate-terms">Illustrative premiums with no deductible. Testnet checkout shows the price and capacity available on-chain.</p>
      <details>
        <summary>Pricing assumptions</summary>
        <p>The lower and middle examples assume 0.1% and 0.5% odds of a full claim per 28 days, respectively.
          The model targets 10% annual provider returns with a buffer of 10% of the limit.
          It assumes 20% cashback and a provider share of 70% of the remaining premium.
          The higher premium example uses 5% of the limit per term.</p>
      </details>
    </article>
  );
}
