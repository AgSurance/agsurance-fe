"use client";

import { useState } from "react";
import styles from "./coverage-economics.module.css";
import { CoverageCalculator } from "./coverage-calculator";

const reserve = 100;
const buffer = 10;
const limit = 40;
const policies = Math.floor((reserve - buffer) / limit);
const locked = policies * limit;
const surplus = reserve - locked - buffer;
const premium = 400;
const loss = 30;
const deductible = 5;
const payout = Math.min(limit, loss - deductible);
const near = (hundredths: number) => `${(hundredths / 100).toFixed(2)} NEAR`;
const claimScenarios = [
  { count: 0, label: "No claims paid" },
  { count: 1, label: "One claim paid" },
  { count: 2, label: "Two claims paid" },
];

export function CoverageEconomics() {
  const [claims, setClaims] = useState(1);
  const [cashback, setCashback] = useState(true);

  const rebate = cashback ? premium * 0.2 : 0;
  const capitalShare = ((premium - rebate) * 7) / 10;
  const operatorShare = premium - rebate - capitalShare;
  const paid = claims * payout;
  const capitalResult = policies * capitalShare - paid * 100;
  const breakEvenPolicies = Math.ceil((paid * 100) / capitalShare);

  return (
    <section className={`section ${styles.section}`} id="economics" aria-labelledby="economics-title">
      <header className={styles.heading}>
        <p className="eyebrow">ILLUSTRATIVE MODEL</p>
        <h2 id="economics-title">Where the money goes</h2>
        <p>A premium is what you pay for coverage. Capital providers put money into the reserve. See how premiums and payouts affect what they earn.</p>
      </header>

      <CoverageCalculator />

      <div className={styles.controls}>
        <fieldset>
          <legend>Choose a payout scenario</legend>
          <p id="claim-scenario-help">Two example policies. Each approved claim pays {payout} NEAR.</p>
          <div className={styles.options}>
            {claimScenarios.map(({ count, label }) => (
              <label key={count}>
                <input type="radio" name="economics-claims" aria-describedby="claim-scenario-help" checked={claims === count} onChange={() => setClaims(count)} />
                <span><strong>{label}</strong><small>{near(count * payout * 100)} total</small></span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className={styles.toggle}>
          <input type="checkbox" checked={cashback} onChange={(event) => setCashback(event.target.checked)} />
          <span>Include 20% cashback</span>
        </label>
      </div>

      <div className={styles.results}>
        <p aria-live="polite" className={styles.scenario}>
          <strong>{near(paid * 100)}</strong> total payout across {claims} {claims === 1 ? "paid claim" : "paid claims"}
        </p>
        <div className={styles.charts}>
          <article className={styles.panel}>
            <p className="eyebrow">EACH 28-DAY POLICY</p>
            <h3>Where the premium goes</h3>
            <p className={styles.total}>{near(premium)}</p>
            <div className={styles.bar} aria-hidden="true">
              <span className={styles.blue} style={{ flex: capitalShare }} />
              <span className={styles.pink} style={{ flex: operatorShare }} />
              <span className={styles.light} style={{ flex: rebate }} />
            </div>
            <dl className={styles.rows}>
              <div><dt><i className={styles.blue} />Capital providers</dt><dd>{near(capitalShare)} · {100 * capitalShare / premium}%</dd></div>
              <div><dt><i className={styles.pink} />AgSurance operations</dt><dd>{near(operatorShare)} · {100 * operatorShare / premium}%</dd></div>
              <div><dt><i className={styles.light} />Policyholder cashback</dt><dd>{near(rebate)} · {100 * rebate / premium}%</dd></div>
            </dl>
          </article>

          <article className={styles.panel}>
            <p className="eyebrow">BEFORE PAYOUTS</p>
            <h3>How we divide the reserve</h3>
            <p className={styles.total}>{reserve} NEAR</p>
            <div className={styles.bar} aria-hidden="true">
              <span className={styles.blue} style={{ flex: locked }} />
              <span className={styles.pink} style={{ flex: buffer }} />
              <span className={styles.light} style={{ flex: surplus }} />
            </div>
            <dl className={styles.rows}>
              <div><dt><i className={styles.blue} />Set aside for {policies} policies</dt><dd>{locked} NEAR</dd></div>
              <div><dt><i className={styles.pink} />Extra funds kept available</dt><dd>{buffer} NEAR</dd></div>
              <div><dt><i className={styles.light} />Funds available for NEAR staking</dt><dd>{surplus} NEAR</dd></div>
            </dl>
          </article>
        </div>

        <div className={styles.outcomes}>
          <article className={styles.outcome}>
            <p className="eyebrow">POLICYHOLDER</p>
            <h3>{payout} NEAR per paid claim</h3>
            <p>For one claim, the reserve pays {payout} NEAR on a {loss} NEAR covered loss with a {deductible} NEAR deductible and no funds recovered before payout.</p>
            <p>In this example, you add 50 NEAR to the agent account. Coverage costs {near(premium)} for 28 days and pays up to {limit} NEAR. {cashback ? `After cashback, coverage costs ${near(premium - rebate)}.` : "No cashback applies."}</p>
          </article>
          <article className={`${styles.outcome} ${styles.capital}`}>
            <p className="eyebrow">CAPITAL PROVIDERS</p>
            <h3>{near(capitalResult)} net result</h3>
            <p>Capital providers receive {near(policies * capitalShare)} from both premiums and pay {near(paid * 100)} in claims. The reserve holds {reserve - paid} NEAR after payouts, before adding any premium income.</p>
            {claims > 0 && <p>Capital providers need <strong>{breakEvenPolicies - claims} policies with no claims</strong> to break even on these payouts. That total can span several 28-day periods.</p>}
          </article>
          <article className={styles.outcome}>
            <p className="eyebrow">AGSURANCE OPERATOR</p>
            <h3>{near(policies * operatorShare)}</h3>
            <p>AgSurance receives this amount from both policies before it pays for reviews, monitoring, and support.</p>
          </article>
        </div>
      </div>

      <p className={styles.note}>The model uses illustrative amounts separate from the testnet demos. It assumes both policies are paid in full and run for 28 days. With cashback on, you get 20% of the premium back at the end even if the reserve paid a claim. Capital results exclude staking rewards and expenses.</p>
    </section>
  );
}
