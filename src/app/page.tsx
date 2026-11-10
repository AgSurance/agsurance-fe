import Image from "next/image";
import Link from "next/link";
import { SpotlightCard } from "./spotlight-card";

const replay = "https://agsurance.github.io/agsurance-fe/";
const payoutReceipt = "https://testnet.nearblocks.io/txns/6EUqDWKJxeoTz8MXnWiCpS8cGGyuguvrhHuLmFqtPtDq/receipts";

function Arrow() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M6 18 18 6M8 6h10v10" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function Brand() {
  return (
    <a className="brand" href="#top" aria-label="AgSurance home">
      <svg aria-hidden="true" width="26" height="28" viewBox="0 0 26 28" fill="none">
        <path d="m13 2 10 5.5V16c0 4-4.8 7.8-10 10-5.2-2.2-10-6-10-10V7.5L13 2Z" stroke="currentColor" strokeWidth="1.7" />
        <path d="m8 17 5-8 5 8m-8.3-2.5h6.6" stroke="currentColor" strokeWidth="1.7" />
      </svg>
      <span>AgSurance</span>
    </a>
  );
}

const features = [
  {
    number: "01",
    title: "Set the mandate",
    description: "Fund a dedicated account and activate coverage in the same setup. Choose who your agent can pay and how much it can spend.",
    icon: "M5 8h22M5 16h22M5 24h22M12 5v6m8 2v6m-9 2v6",
  },
  {
    number: "02",
    title: "Let the agent pay",
    description: "Your agent can pay approved recipients and renew coverage using its account balance.",
    icon: "M5 16h20m-7-7 7 7-7 7M7 9h6m-6 14h6",
  },
  {
    number: "03",
    title: "File a claim",
    description: "If a wallet exploit causes an eligible loss, reviewers compare the final NEAR receipt with your original mandate.",
    icon: "M16 3 27 8v8c0 5-5 9-11 13C10 25 5 21 5 16V8l11-5Zm-5 12 4 4 7-8",
  },
];

export default function Home() {
  return (
    <div className="site" id="top">
      <a className="skip" href="#main-content">Skip to content</a>
      <header className="site-header">
        <Brand />
        <nav aria-label="Main navigation" className="main-nav">
          <a href="#how-it-works">How it works</a>
          <a href="#coverage">Coverage</a>
        </nav>
        <Link className="header-link" href="/demo">Live testnet demo <Arrow /></Link>
      </header>
      <main id="main-content">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-content">
            <p className="eyebrow"><span /> AGENT ACCOUNTS ON NEAR</p>
            <h1 id="hero-title">Set the limits.<br />Let your agent <em>pay.</em></h1>
            <p className="hero-caption">
              Give your AI agent a NEAR account with spending limits and coverage for
              eligible losses if those limits are bypassed.
            </p>
            <div className="hero-actions">
              <a className="primary-action" href={replay}>Replay a testnet claim <Arrow /></a>
              <Link className="text-action" href="/demo">Run the live testnet demo <Arrow /></Link>
            </div>
            <p className="hero-note">The replay needs no wallet. The live demo requires local setup.</p>
          </div>
          <figure className="hero-figure">
            <div className="hero-art">
              <Image
                src="/account-reserve.jpg"
                alt=""
                fill
                preload
                sizes="(max-width: 760px) 92vw, (max-width: 1500px) 46vw, 690px"
                className="hero-image"
              />
            </div>
            <figcaption>
              <span><i /> 01 / Agent account</span>
              <span><i /> 02 / Separate claim reserve</span>
            </figcaption>
          </figure>
        </section>

        <section className="section" id="how-it-works" aria-labelledby="flow-title">
          <div className="section-heading">
            <p className="eyebrow"><span /> HOW IT WORKS</p>
            <h2 id="flow-title">From funding<br /><span>to filing a claim.</span></h2>
          </div>
          <div className="features">
            {features.map(({ number, title, description, icon }) => (
              <SpotlightCard key={number}>
                <div className="feature-art" aria-hidden="true">
                  <svg width="64" height="64" viewBox="0 0 32 32" fill="none">
                    <path d={icon} stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="feature-number">{number} / ACCOUNT FLOW</p>
                <h3>{title}</h3>
                <p>{description}</p>
              </SpotlightCard>
            ))}
          </div>
        </section>

        <section className="section coverage" id="coverage" aria-labelledby="coverage-title">
          <div>
            <p className="eyebrow"><span /> COVERAGE</p>
            <h2 id="coverage-title">When a wallet<br />exploit causes loss.</h2>
            <p className="coverage-copy">The proposed cover applies when an execution flaw lets funds leave an active account against its recorded spending rules and causes a direct loss.</p>
            <p className="coverage-copy">Reviewers assess the evidence. Approved claims draw from funds reserved for the policy.</p>
          </div>

          <article className="claim" id="claim" aria-labelledby="claim-title">
            <div className="claim-heading">
              <p className="eyebrow"><span /> NEAR TESTNET CLAIM</p>
              <h3 id="claim-title">A transfer outside the mandate</h3>
            </div>
            <dl className="claim-amounts">
              <div><dt>Simulated loss</dt><dd>0.30 NEAR</dd></div>
              <div><dt>Deductible</dt><dd>−0.05 NEAR</dd></div>
              <div className="claim-total"><dt>Paid to recovery account</dt><dd>0.25 NEAR</dd></div>
            </dl>
            <a className="claim-receipt" href={payoutReceipt}>Verify the testnet payout <Arrow /></a>
            <details>
              <summary>What did reviewers verify?</summary>
              <p>The final NEAR transfer receipt, the spending rules in force at the time, and the coverage window.</p>
            </details>
          </article>
        </section>
      </main>

      <footer className="site-footer">
        <Brand />
        <p>AgSurance · NEAR testnet design preview</p>
        <a href="#top">Back to top <Arrow /></a>
      </footer>
    </div>
  );
}
