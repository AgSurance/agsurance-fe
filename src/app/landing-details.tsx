import Link from "next/link";

type RoleStep = {
  role: string;
  description: string;
  next?: string;
  twoWay?: boolean;
  reserve?: boolean;
};

const roleFlows: { title: string; steps: RoleStep[] }[] = [
  {
    title: "Spend within the mandate",
    steps: [
      { role: "Policyholder", description: "Funds the agent wallet, pays the premium and sets the supplier and spending limit.", next: "Sets the mandate" },
      { role: "Agent", description: "Requests payments and renews coverage with a restricted NEAR key.", next: "Wallet pays" },
      { role: "Supplier", description: "Receives payments the wallet authorizes under the mandate." },
    ],
  },
  {
    title: "Review and pay a claim",
    steps: [
      { role: "Agent", description: "Submits a claim for a loss from the registered wallet.", next: "Files the claim" },
      { role: "Claim reviewers", description: "Check the NEAR receipt, mandate and paid coverage period.", next: "2 of 3 approve" },
      { role: "Claims reserve", description: "Funds the approved claim up to the applicable policy limit.", next: "Sends the payout", reserve: true },
      { role: "Recovery account", description: "Receives the payout at the address registered for the policy." },
    ],
  },
  {
    title: "Fund the reserve and stake surplus",
    steps: [
      { role: "Capital providers", description: "Deposit NEAR for shares. Paid claims can reduce the value of those shares.", next: "Deposit NEAR" },
      { role: "Claims reserve", description: "The AgSurance operator manages liquidity for claims and delegates eligible surplus.", next: "Stake and rewards", twoWay: true, reserve: true },
      { role: "NEAR validator", description: "Receives eligible surplus for staking. Realized rewards return to the reserve." },
    ],
  },
];

export function Parties() {
  return (
    <section className="landing-subsection parties" id="roles" aria-labelledby="roles-title">
      <h3 id="roles-title">Who does what</h3>
      {roleFlows.map(({ title, steps }) => (
        <div className="role-flow" key={title}>
          <h4>{title}</h4>
          <ol role="list">
            {steps.map(({ role, description, next, twoWay, reserve }) => (
              <li key={role}>
                <div className={reserve ? "role-card role-reserve" : "role-card"}>
                  <strong>{role}</strong>
                  <p>{description}</p>
                </div>
                {next && (
                  <div className={twoWay ? "role-connector role-two-way" : "role-connector"}>
                    <span>{next}</span>
                    <span className="role-arrow" aria-hidden="true" />
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </section>
  );
}

const flows = [
  {
    title: "Policyholder",
    steps: [
      ["Fund the wallet", "Operating NEAR stays in the agent wallet for approved payments."],
      ["Pay the premium", "The vault collects the premium for the paid coverage period."],
      ["Receive an approved payout", "The reserve sends it to the registered recovery account."],
    ],
  },
  {
    title: "Capital provider",
    steps: [
      ["Deposit NEAR", "The reserve issues shares at the pool’s current value."],
      ["Set aside liquid funds", "Policy allocations and the buffer take priority. Claim payouts reduce reserve assets."],
      ["Delegate eligible surplus", "The pool can stake surplus with a NEAR validator up to its configured cap. Realized rewards return to the pool and accrue to providers by share."],
    ],
  },
];

export function MoneyFlows() {
  return (
    <div className="landing-subsection">
      <h3>Two paths for NEAR</h3>
      <div className="landing-columns">
        {flows.map(({ title, steps }) => (
          <div className="money-path" key={title}>
            <h4>{title}</h4>
            <ol>
              {steps.map(([label, detail]) => <li key={label}><strong>{label}</strong><p>{detail}</p></li>)}
            </ol>
          </div>
        ))}
      </div>
      <p className="landing-note">The pilot pays 20% cashback on earned premium if the full term was paid without a coverage gap and the wallet has not been retired. Providers receive 70% of the remainder and the operator receives 30%. These percentages divide premium revenue. Provider returns depend on claims, actual staking rewards and costs.</p>
    </div>
  );
}

export function CoverageGuide() {
  return (
    <section className="section landing-guide" id="incidents" aria-labelledby="incident-title">
      <h2 id="incident-title">What the policy covers</h2>
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
      <div className="landing-subsection">
        <h3>What if the wallet had an AgSurance policy?</h3>
        <div className="incident-list">
          <article>
            <h4>Ledger Connect Kit, December 2023</h4>
            <p>Compromised code in a wallet connection library affected users of third-party apps. An affected personal wallet would fall outside this pilot. In an analogous case, a final NEAR transfer from an enrolled agent wallet to a recipient outside its mandate during paid coverage could be reviewed.</p>
            <a href="https://www.ledger.com/blog/a-letter-from-ledger-chairman-ceo-pascal-gauthier-regarding-ledger-connect-kit-exploit">Ledger’s incident report</a>
          </article>
          <article>
            <h4>Ronin bridge, March 2022</h4>
            <p>Funds were drained from the bridge. A policy on a NEAR agent wallet would leave this loss outside scope because the funds left a bridge rather than the enrolled agent wallet.</p>
            <a href="https://blog.roninchain.com/p/the-ronin-bridge-is-open-">Ronin’s incident update</a>
          </article>
          <article>
            <h4>Slope wallets, August 2022</h4>
            <p>Compromised private keys were used to drain wallets on Solana. Those wallet losses fall outside the pilot. On AgSurance, an agent key is restricted to specific vault methods, and a claim would still require a qualifying final transfer from the registered NEAR wallet.</p>
            <a href="https://solana.com/news/8-2-2022-application-wallet-incident">Solana Foundation’s incident update</a>
          </article>
          <article>
            <h4>AgSurance’s NEAR testnet run</h4>
            <p>After a separate simulated loss of 0.30 NEAR, two reviewers approved the claim and the reserve paid 0.25 NEAR after the deductible.</p>
            <Link href="/demo#cli-run">Open the replay and receipts</Link>
          </article>
        </div>
      </div>
    </section>
  );
}

const questions = [
  ["Who can spend the wallet balance?", "The agent’s restricted NEAR key can request payments through the vault. The wallet enforces the approved supplier and cumulative spending limit. The owner can revoke the agent’s access."],
  ["How much can a claim pay?", "An approved payout uses the eligible loss after recoveries and the deductible, capped by the policy limit in force when the loss occurred."],
  ["Does a blocked payment qualify for reimbursement?", "A blocked payment leaves no funds lost. A claim requires a finalized transfer from the registered wallet and evidence that it breached the policy’s mandate."],
  ["Can capital providers lose principal?", "Yes. Approved claims are paid from the reserve. The value of a share reflects those payouts as well as the provider’s share of earned premiums and realized staking rewards."],
  ["Does the reserve stake all deposited NEAR?", "Only eligible surplus can be delegated, after claim allocations and the buffer and subject to a configured cap. Unstaking takes time, so delegated funds are separate from liquid reserve assets."],
  ["Do I need an invite to see a claim?", "The two completed testnet runs and their NEAR receipts are public. The invite is for running a new demo with a funded account."],
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
    </section>
  );
}
