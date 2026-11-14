import Link from "next/link";
import type { ReactNode } from "react";
import { ClaimDiagram } from "./landing-motion";

function RoleNode({ title, children, className = "", claimStep }: { title: string; children: ReactNode; className?: string; claimStep?: number }) {
  return <div className={`role-node ${className}`} data-claim-step={claimStep}><h5>{title}</h5><p>{children}</p></div>;
}

function RoleArrow({ children, className = "", claimStep }: { children: string; className?: string; claimStep?: number }) {
  return <div className={`role-arrow ${className}`} data-claim-step={claimStep}><span>{children}</span><i aria-hidden="true" /></div>;
}

export function Parties() {
  return (
    <section className="landing-subsection parties" id="roles" aria-labelledby="roles-title">
      <h3 id="roles-title">Who does what</h3>
      <ClaimDiagram>
        <div className="role-layer role-actors">
          <h4>Policy &amp; agent</h4>
          <RoleNode title="Policyholder">Funds the wallet, pays the premium and sets the spending mandate.</RoleNode>
          <RoleArrow>Sets the mandate</RoleArrow>
          <RoleNode title="Agent" claimStep={0}>Requests payments, renews coverage and can file a claim with a restricted NEAR key.</RoleNode>
        </div>
        <RoleArrow className="role-request">Requests payment</RoleArrow>
        <div className="role-layer role-payments">
          <h4>Payment controls</h4>
          <RoleNode title="Vault &amp; agent wallet">Checks who can be paid and enforces the spending limit.</RoleNode>
          <RoleArrow>Pays</RoleArrow>
          <RoleNode title="Approved supplier">Receives payments that satisfy the mandate.</RoleNode>
        </div>
        <div className="role-claim-wire role-vertical" data-claim-step={1} aria-hidden="true"><span>Files a claim</span><i /></div>
        <div className="role-layer role-claims">
          <h4>Claims &amp; settlement</h4>
          <RoleNode title="Claim reviewers" claimStep={2}>Check the agent’s claim against the NEAR receipt, mandate and paid coverage period.</RoleNode>
          <RoleArrow claimStep={3}>2 of 3 approve</RoleArrow>
          <RoleNode title="Claims reserve" className="role-reserve" claimStep={4}>Pays approved claims up to the applicable limit. The AgSurance operator manages its liquidity.</RoleNode>
          <RoleArrow claimStep={5}>Sends payout</RoleArrow>
          <RoleNode title="Recovery account" claimStep={6}>Receives the payout at the registered address.</RoleNode>
        </div>
        <div className="role-capital-wire" aria-hidden="true"><span>Deposits NEAR</span><i /></div>
        <div className="role-staking-wire role-vertical" aria-hidden="true"><span>Surplus ↓ · rewards ↑</span><i /></div>
        <div className="role-layer role-capital">
          <h4>Capital &amp; staking</h4>
          <RoleNode title="Capital providers">Deposit NEAR into the claims reserve for shares. Paid claims can reduce share value.</RoleNode>
          <RoleNode title="NEAR validator">Receives eligible surplus for staking and returns realized rewards to the reserve.</RoleNode>
        </div>
      </ClaimDiagram>
    </section>
  );
}

export function CoverageGuide() {
  return (
    <section className="section landing-guide" id="coverage" aria-labelledby="coverage-title">
      <p className="eyebrow">TESTNET COVER</p>
      <h2 id="coverage-title">Agent Wallet Cover</h2>
      <p className="cover-intro">Covers eligible NEAR losses when funds leave your registered agent wallet in a transfer that breaks its spending rules during paid coverage.</p>

      <div className="landing-columns cover-events">
        <section aria-labelledby="covered-events-title">
          <h3 id="covered-events-title">What it covers</h3>
          <dl>
            <div>
              <dt>Unapproved recipient</dt>
              <dd>NEAR reaches a recipient other than the supplier named in the policy.</dd>
            </div>
            <div>
              <dt>Transfer above the spending limit</dt>
              <dd>NEAR reaches the approved supplier in a single transfer larger than the amount allowed by the policy’s spending rules.</dd>
            </div>
          </dl>
        </section>
        <section aria-labelledby="cover-exclusions-title">
          <h3 id="cover-exclusions-title">What it excludes</h3>
          <dl>
            <div>
              <dt>Blocked or failed payments</dt>
              <dd>The attempted transfer leaves no eligible loss.</dd>
            </div>
            <div>
              <dt>Bad purchases within the rules</dt>
              <dd>A duplicate invoice or unwanted purchase paid to the approved supplier within the limit. <a href="/demo#duplicate-invoice">See the duplicate invoice example.</a></dd>
            </div>
            <div>
              <dt>Other assets, wallets and market losses</dt>
              <dd>Tokens other than native NEAR, losses from personal wallets or bridges, losses on other chains, and price drops.</dd>
            </div>
          </dl>
        </section>
      </div>

      <div className="landing-columns cover-terms">
        <section aria-labelledby="cover-eligibility-title">
          <h3 id="cover-eligibility-title">Eligibility</h3>
          <dl>
            <div>
              <dt>Wallet and asset</dt>
              <dd>The loss must be a finalized native NEAR transfer from the agent wallet registered to the policy on NEAR testnet.</dd>
            </div>
            <div>
              <dt>Coverage at the time of loss</dt>
              <dd>The transfer must occur during a paid coverage window.</dd>
            </div>
            <div>
              <dt>Proof of loss</dt>
              <dd>Provide the transaction hash and transfer receipt so reviewers can check the wallet, recipient, amount and block.</dd>
            </div>
          </dl>
        </section>
        <section aria-labelledby="cover-payout-title">
          <h3 id="cover-payout-title">Claims and payouts</h3>
          <dl>
            <div>
              <dt>Filing deadline</dt>
              <dd>Standard testnet policies allow filing for up to 48 hours after the term ends. Use the deadline shown for your policy.</dd>
            </div>
            <div>
              <dt>0.05 NEAR deductible</dt>
              <dd>Subtract any funds recovered before payout and the deductible from the eligible loss. The result must be positive.</dd>
            </div>
            <div>
              <dt>Payout limit</dt>
              <dd>The policy limit in force at the loss caps the payout. The spending limit applies to agent payments. <a href="/demo#historical-limit">See the historical limit in action.</a></dd>
            </div>
            <div>
              <dt>Approval and payment</dt>
              <dd>Two of three reviewers must approve the evidence. The reserve sends the approved payout to the registered recovery account.</dd>
            </div>
          </dl>
        </section>
      </div>

      <div className="landing-subsection" id="incidents">
        <h3>What if the wallet had an AgSurance policy?</h3>
        <article className="incident-example">
          <h4>Ledger Connect Kit, December 2023</h4>
          <p>Compromised wallet connection code affected users of third-party apps. This pilot excludes personal wallet losses. A similar incident on an enrolled NEAR agent wallet could be reviewed if a final transfer breached its spending mandate during paid coverage.</p>
          <a href="https://www.ledger.com/blog/a-letter-from-ledger-chairman-ceo-pascal-gauthier-regarding-ledger-connect-kit-exploit">Ledger’s incident report</a>
        </article>
      </div>
    </section>
  );
}

const questions = [
  ["Can capital providers lose principal?", "Yes. Approved claims draw from the reserve and can reduce the value of its shares. Earned premiums and realized staking rewards can offset losses."],
];

export function LandingFaq() {
  return (
    <section className="section landing-faq" id="faq" aria-labelledby="faq-title">
      <h2 id="faq-title">Frequently asked questions</h2>
      {questions.map(([question, answer]) => (
        <details key={question}>
          <summary>{question}</summary>
          <p>{answer}</p>
        </details>
      ))}
      <details>
        <summary>How do I see the demo without an invite?</summary>
        <p>Anyone can open the <Link href="/demo#cli-run">two testnet replays and their public receipts</Link>. An invite gives you access to a funded demo account.</p>
      </details>
    </section>
  );
}
