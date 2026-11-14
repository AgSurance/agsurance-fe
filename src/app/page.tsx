import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { cliPayoutHash, cliReceipts, historicalPayoutHash, receiptUrl } from "../lib/demo-links";
import { manualDemoContracts } from "../lib/manual-demo";
import { CoverageEconomics } from "./coverage-economics";
import { CoverageGuide, LandingFaq, Parties } from "./landing-details";
import { PaymentGate } from "./landing-motion";
import { ReserveOverview } from "./reserve-overview";

const payoutTransferUrl = `https://testnet.nearblocks.io/txns/${cliPayoutHash}/execution#CP7xzmJD3ahDQyqixzv5yYCPdbRHmh6oxYH3c2EybtnS`;

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

export default function Home() {
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
        <a className="header-link" href="#claim">Testnet evidence</a>
      </header>
      <main id="main-content">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-content">
            <p className="eyebrow">TESTNET PREVIEW</p>
            <h1 id="hero-title">Insurance for<br />AI agents on NEAR.</h1>
            <p className="hero-caption">
              Set who your agent can pay and how much it can spend. Agent Wallet Cover can reimburse eligible NEAR losses from transfers that break those rules.
            </p>
            <div className="hero-actions">
              <a className="primary-action" href="#claim">See the 0.25 NEAR payout</a>
              {manualCheckout && <Link href="/demo#manual-demo">Try with your testnet wallet</Link>}
              <a href="#coverage">See what’s covered</a>
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
              <span className="hero-signal" aria-hidden="true" />
            </div>
            <figcaption>
              <span><i /> Agent account</span>
              <span><i /> Claims reserve</span>
            </figcaption>
          </figure>
        </section>

        <section className="section judge-evidence" aria-labelledby="claim-title">
          <div className="proof-grid" id="claim" tabIndex={-1}>
            <div>
              <p className="eyebrow">NEAR TESTNET · PUBLIC RECEIPTS</p>
              <h2 id="claim-title">0.25 NEAR paid</h2>
              <p className="proof-copy">One CLI run shows both payment decisions and a claim for a separate simulated loss.</p>
              <ul className="proof-links">
                <li><a href={receiptUrl(cliReceipts.declined)}>0.01 NEAR payment blocked <ExternalArrow /></a></li>
                <li><a href={receiptUrl(cliReceipts.payment)}>0.05 NEAR paid to the approved supplier <ExternalArrow /></a></li>
                <li><a href={receiptUrl(cliReceipts.claim)}>Claim filed from the CLI <ExternalArrow /></a></li>
              </ul>
              <Link className="proof-action" href="/demo#cli-run">Open the full CLI replay</Link>
            </div>
            <div className="claim">
              <dl className="claim-amounts">
                <div><dt>Simulated loss</dt><dd>0.30 NEAR</dd></div>
                <div><dt>Deductible</dt><dd>−0.05 NEAR</dd></div>
                <div className="claim-total"><dt>Paid to the recovery account</dt><dd>0.25 NEAR</dd></div>
              </dl>
              <a className="claim-receipt" href={payoutTransferUrl}>
                <Image
                  src="/payout-receipt.jpg"
                  alt=""
                  width={542}
                  height={108}
                  sizes="(max-width: 760px) 82vw, 36vw"
                />
                <span>View payout receipt on NearBlocks <ExternalArrow /></span>
              </a>
            </div>
          </div>

          <article className="historical-proof" aria-labelledby="historical-proof-title">
            <div>
              <h3 id="historical-proof-title">Why a second claim paid 0.18 NEAR</h3>
              <p>The policy limit rose to 0.42 NEAR before filing. The reserve paid 0.18 NEAR, the limit in force when the loss occurred.</p>
            </div>
            <div className="historical-links">
              <Link href="/demo#historical-limit">Trace the limit change</Link>
              <a href={receiptUrl(historicalPayoutHash)}>View the 0.18 NEAR payout <ExternalArrow /></a>
            </div>
          </article>
        </section>

        <section className="section" id="how-it-works" aria-labelledby="flow-title">
          <div className="flow">
            <div>
              <h2 id="flow-title">From spending rules to claims</h2>
              <p className="flow-caption">The wallet checks payments against the spending mandate. Reviewers use that mandate and the finalized NEAR receipt to assess a loss.</p>
            </div>
            <PaymentGate />
          </div>
          <Parties />
        </section>

        <CoverageGuide />

        <section className="section landing-reserve" id="reserve" aria-labelledby="reserve-title">
          <h2 id="reserve-title">The claims reserve</h2>
          <Suspense fallback={<p role="status">Reading reserve figures from NEAR testnet…</p>}>
            <ReserveOverview />
          </Suspense>
          <figure className="reserve-art">
            <Image
              src="/reserve-compartments.webp"
              alt=""
              width={1200}
              height={800}
              sizes="(max-width: 500px) 90vw, 460px"
            />
            <figcaption>Reserve structure · Policy allocations, liquidity buffer and surplus eligible for staking</figcaption>
          </figure>
        </section>

        <CoverageEconomics showCheckout={manualCheckout} />
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
