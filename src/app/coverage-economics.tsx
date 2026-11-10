"use client";

import { useState } from "react";
import styles from "./coverage-economics.module.css";

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
        <p className="eyebrow"><span /> COVERAGE ECONOMICS / DRAFT</p>
        <h2 id="economics-title">Follow the NEAR.</h2>
        <p>See where premiums go, what backs a claim, and how payouts affect the people who fund the reserve.</p>
      </header>

      <div className={styles.controls}>
        <fieldset>
          <legend>Approved claims across two policies</legend>
          <div className={styles.options}>
            {[0, 1, 2].map((count) => (
              <label key={count}>
                <input type="radio" name="economics-claims" checked={claims === count} onChange={() => setClaims(count)} />
                <span>{count}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className={styles.toggle}>
          <input type="checkbox" checked={cashback} onChange={(event) => setCashback(event.target.checked)} />
          <span>Include 20% cashback</span>
        </label>
      </div>

      <div aria-live="polite" className={styles.results}>
        <div className={styles.charts}>
          <article className={styles.panel}>
            <p className="eyebrow">01 / EACH 28-DAY POLICY</p>
            <h3>Where the premium goes</h3>
            <p className={styles.total}>{near(premium)}</p>
            <div className={styles.bar} aria-hidden="true">
              <span className={styles.blue} style={{ flex: capitalShare }} />
              <span className={styles.pink} style={{ flex: operatorShare }} />
              <span className={styles.light} style={{ flex: rebate }} />
            </div>
            <dl className={styles.rows}>
              <div><dt><i className={styles.blue} />Capital providers</dt><dd>{near(capitalShare)}</dd></div>
              <div><dt><i className={styles.pink} />AgSurance operations</dt><dd>{near(operatorShare)}</dd></div>
              <div><dt><i className={styles.light} />Customer cashback</dt><dd>{near(rebate)}</dd></div>
            </dl>
          </article>

          <article className={styles.panel}>
            <p className="eyebrow">02 / BEFORE ANY CLAIMS ARE PAID</p>
            <h3>How the reserve is allocated</h3>
            <p className={styles.total}>{reserve} NEAR</p>
            <div className={styles.bar} aria-hidden="true">
              <span className={styles.blue} style={{ flex: locked }} />
              <span className={styles.pink} style={{ flex: buffer }} />
              <span className={styles.light} style={{ flex: surplus }} />
            </div>
            <dl className={styles.rows}>
              <div><dt><i className={styles.blue} />Locked for {policies} policies</dt><dd>{locked} NEAR</dd></div>
              <div><dt><i className={styles.pink} />Liquid buffer</dt><dd>{buffer} NEAR</dd></div>
              <div><dt><i className={styles.light} />Surplus eligible for NEAR staking</dt><dd>{surplus} NEAR</dd></div>
            </dl>
          </article>
        </div>

        <div className={styles.outcomes}>
          <article className={styles.outcome}>
            <p className="eyebrow">POLICYHOLDER</p>
            <h3>{payout} NEAR</h3>
            <p>Paid per approved claim in this scenario. A {loss} NEAR covered loss with no recovery, less a {deductible} NEAR deductible.</p>
            <p>Fund the agent with 50 NEAR. Pay {near(premium)} over 28 days for up to {limit} NEAR in payouts. After cashback, the premium costs {near(premium - rebate)}.</p>
          </article>
          <article className={`${styles.outcome} ${styles.capital}`}>
            <p className="eyebrow">CAPITAL PROVIDERS</p>
            <h3>{near(capitalResult)}</h3>
            <p>From both policies, {near(policies * capitalShare)} in premium share less {near(paid * 100)} in claims. The reserve holds {reserve - paid} NEAR after payouts, before premium income.</p>
            {claims > 0 && <p><strong>{breakEvenPolicies - claims} claim-free policies</strong> needed in total to cover these payouts, counted across policy periods.</p>}
          </article>
          <article className={styles.outcome}>
            <p className="eyebrow">AGSURANCE OPERATOR</p>
            <h3>{near(policies * operatorShare)}</h3>
            <p>Gross revenue from both policies, before the cost of claim reviews, monitoring, and support.</p>
          </article>
        </div>
      </div>

      <p className={styles.note}>Illustrative 28-day scenario. Both policies are fully paid. With cashback enabled, both complete the term and qualify even if a claim is paid. Staking rewards and expenses are excluded from the capital result.</p>
    </section>
  );
}
