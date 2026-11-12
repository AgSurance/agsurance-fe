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
      <h2 id="coverage-title">What the policy covers</h2>
      <p className="landing-note">The spending limit controls what the agent can pay. The payout limit caps an approved claim at the policy limit in force when the loss happened.</p>
      <div className="landing-columns">
        <div>
          <h3>Eligible for review</h3>
          <ul>
            <li>A finalized NEAR transfer from the registered agent wallet to a recipient outside the mandate.</li>
            <li>A finalized transfer from that wallet that exceeds the recorded spending limit.</li>
            <li>The loss must occur during paid coverage. Reviewers confirm the evidence and eligible loss must exceed the deductible.</li>
          </ul>
        </div>
        <div>
          <h3>Outside this policy</h3>
          <ul>
            <li>A blocked payment, with no loss to reimburse.</li>
            <li>A duplicate invoice or bad purchase paid to the approved supplier within the mandate.</li>
            <li>Funds lost from a personal wallet, a third-party bridge or a different chain. Token price losses are also outside scope.</li>
          </ul>
        </div>
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
  ["How much could I recover?", "An approved payout uses the eligible loss after recoveries and the deductible, capped by the policy limit in force when the loss occurred."],
  ["What evidence do I need for a claim?", "Provide the transaction hash and finalized NEAR transfer receipt. Reviewers check the recipient, amount and whether the policy was active at the time of the loss."],
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
