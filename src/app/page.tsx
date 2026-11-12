import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { cliPayoutHash, receiptUrl, reserveReplayUrl } from "../lib/demo-links";
import { hostedDemoEnabled } from "../lib/hosted-demo";
import { manualDemoContracts } from "../lib/manual-demo";
import { CoverageEconomics } from "./coverage-economics";
import { CoverageGuide, LandingFaq, MoneyFlows, Parties } from "./landing-details";
import { ReserveOverview } from "./reserve-overview";

function ExternalArrow() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M6 18 18 6M8 6h10v10" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function Brand() {
  return (
    <a className="brand" href="#top" aria-label="AgSurance home">
      <Image src="/agsurance-logo.png" width={28} height={28} alt="" />
      <span>AgSurance</span>
    </a>
  );
}

const features = [
  {
    title: "Set spending rules",
    description: "Add funds to the agent account and buy coverage. Choose who your agent can pay and how much it can spend.",
  },
  {
    title: "Let the agent pay",
    description: "Your agent can pay the people and services you approve. It can also pay to renew coverage from the same account.",
  },
  {
    title: "File a claim",
    description: "If a wallet flaw causes a loss, file a claim. Reviewers compare the NEAR transaction receipt with the spending rules in effect at the time.",
  },
];

export default function Home() {
  const hosted = process.env.VERCEL === "1";
  const showLiveLink = !hosted || hostedDemoEnabled();
  const manualCheckout = !!manualDemoContracts().factory;

  return (
    <div className="site" id="top">
      <a className="skip" href="#main-content">Skip to content</a>
      <header className="site-header">
        <Brand />
        <nav aria-label="Main navigation" className="main-nav">
          <a href="#how-it-works">How it works</a>
          <a href="#coverage">Coverage</a>
          <a href="#economics">Economics</a>
          <a href="#faq">FAQ</a>
        </nav>
        <Link className="header-link" href="/demo#cli-run">Testnet evidence</Link>
      </header>
      <main id="main-content">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-content">
            <p className="eyebrow">TESTNET PREVIEW</p>
            <h1 id="hero-title">Insurance for<br />AI agents on NEAR.</h1>
            <p className="hero-caption">
              Give your agent an account with spending rules you set. If a wallet flaw lets funds leave against those rules, you can file a claim.
            </p>
            <div className="hero-actions">
              <Link className="primary-action" href={manualCheckout ? "/demo#manual-demo" : "/demo#cli-run"}>
                {manualCheckout ? "Try with your testnet wallet" : "View the verified CLI run"}
              </Link>
            </div>
            <div className="hero-links">
              {manualCheckout && <Link href="/demo#cli-run">View the verified CLI run</Link>}
              <a href={reserveReplayUrl}>Replay the shared reserve claim <ExternalArrow /></a>
              {showLiveLink && <Link href="/demo#live-demo">{hosted ? "Run a demo with an invite" : "Open the local testnet demo"}</Link>}
            </div>
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
              <span><i /> Agent account</span>
              <span><i /> Claims reserve</span>
            </figcaption>
          </figure>
        </section>

        <section className="section market-statement" aria-labelledby="statement-title">
          <h2 id="statement-title">Agents can spend.<br />Who pays when the wallet fails?</h2>
          <ul>
            <li><strong>Before the loss.</strong> The wallet enforces who the agent can pay and how much it can spend.</li>
            <li><strong>After a covered loss.</strong> Reviewers check the NEAR receipt. A separate reserve funds the approved payout.</li>
          </ul>
        </section>

        <section className="section" id="how-it-works" aria-labelledby="flow-title">
          <div className="flow">
            <h2 id="flow-title">From spending rules to claims</h2>
            <ol className="features">
              {features.map(({ title, description }) => (
                <li key={title}>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </li>
              ))}
            </ol>
          </div>
          <Parties />
        </section>

        <section className="section coverage" id="coverage" aria-labelledby="coverage-title">
          <div>
            <p className="eyebrow">COVERAGE</p>
            <h2 id="coverage-title">When a wallet flaw<br />causes a loss.</h2>
            <p className="coverage-copy">The proposed policy covers direct losses if a wallet flaw lets funds leave against the recorded spending rules while coverage is active.</p>
            <p className="coverage-copy">The reserve holds money for claims. Reviewers examine the evidence. If they approve the claim, the reserve pays it.</p>
          </div>

          <article className="claim" id="claim" aria-labelledby="claim-title">
            <div className="claim-heading">
              <p className="eyebrow">VERIFIED CLI RUN</p>
              <h3 id="claim-title">A payout after a simulated loss</h3>
            </div>
            <dl className="claim-amounts">
              <div><dt>Simulated loss</dt><dd>0.30 NEAR</dd></div>
              <div><dt>Deductible (your share of the loss)</dt><dd>−0.05 NEAR</dd></div>
              <div className="claim-total"><dt>Paid to recovery account</dt><dd>0.25 NEAR</dd></div>
            </dl>
            <a className="claim-receipt" href={receiptUrl(cliPayoutHash)}>View the payout on NEAR testnet <ExternalArrow /></a>
            <details>
              <summary>What did reviewers look at?</summary>
              <p>Reviewers checked the final NEAR transfer receipt and the spending rules in effect at the time. They also checked whether coverage was active.</p>
            </details>
          </article>
        </section>

        <CoverageGuide />

        <section className="section landing-reserve" id="reserve" aria-labelledby="reserve-title">
          <p className="eyebrow">NEAR TESTNET</p>
          <h2 id="reserve-title">The claims reserve</h2>
          <Suspense fallback={<p role="status">Reading reserve figures from NEAR testnet…</p>}>
            <ReserveOverview />
          </Suspense>
          <MoneyFlows />
        </section>

        <CoverageEconomics />
        <LandingFaq />
      </main>

      <footer className="site-footer">
        <Brand />
        <p>AgSurance · NEAR testnet design preview</p>
        <a href="#top">Back to top</a>
      </footer>
    </div>
  );
}
