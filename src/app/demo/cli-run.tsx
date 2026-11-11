import { cliPayoutHash, receiptUrl } from "../../lib/demo-links";

const run = {
  "vault": "vault.agsurance-7910a4d8.testnet",
  "policy": 1,
  "supplier": "supplier.agsurance-7910a4d8.testnet",
  "incidentRecipient": "incident.agsurance-7910a4d8.testnet",
  "beneficiary": "recovery.agsurance-7910a4d8.testnet",
  "hashes": {
    "checkout": "9z5JCov2sVrZYE3gN9nyE4vBmtHe9KZYiwAZVGzH62pw",
    "connect": "32tQ1gya41MBpNtBWKn6HvPErxp6Acdg9aLMARmauteb",
    "declined": "FkB8zVFCydDbMhukMQeB6FHBUDb7xGU2qKhrKcZWzyCz",
    "payment": "9MmWAmKmQWoTUAt9SC4mHbgvsZye4RtMZG5CZz4XDbsx",
    "loss": "4xLhrcrh6uBeQzqF3YdYiamGR4ysBw2GcQRxVwFpuxa5",
    "claim": "FDhbHXvusRjuPNn4X2d7xcZkhZjAuUQjDvVd1N6bxWji",
    "vote1": "4QQF7JEdqGjDnyySY3co9RKZLMD3bVA8SwhskPz8RD3X",
    "vote2": "8m4Yg68qLei14rVzwwhYEhJ8aSLFyov2E3A7u3Wdp8NH",
    "payout": cliPayoutHash
  }
};

const steps = [
  {
    title: "Activate the policy",
    result: "The owner records the supplier and sets a 0.05 NEAR spending limit.",
    links: [{ label: "Checkout receipt", hash: run.hashes.checkout }],
  },
  {
    title: "Connect the agent",
    result: "The owner grants the agent permission to call the vault.",
    links: [{ label: "Agent grant receipt", hash: run.hashes.connect }],
  },
  {
    title: "Reject a payment outside the mandate",
    result: "The CLI requests 0.01 NEAR to the recovery account. The wallet rejects the request and sends no funds.",
    links: [{ label: "Rejected payment receipt", hash: run.hashes.declined }],
  },
  {
    title: "Pay the approved supplier",
    result: "The same CLI agent pays 0.05 NEAR to the supplier in the mandate.",
    links: [{ label: "Supplier payment receipt", hash: run.hashes.payment }],
  },
  {
    title: "Record a simulated loss",
    result: "The demo runner sends 0.30 NEAR to a separate test incident account.",
    links: [{ label: "Simulated loss receipt", hash: run.hashes.loss }],
  },
  {
    title: "File and review the claim",
    result: "The agent files from the CLI. Two reviewers approve the same final loss receipt.",
    links: [
      { label: "CLI claim receipt", hash: run.hashes.claim },
      { label: "Reviewer 1 receipt", hash: run.hashes.vote1 },
      { label: "Reviewer 2 receipt", hash: run.hashes.vote2 },
    ],
  },
  {
    title: "Pay 0.25 NEAR",
    result: "The reserve pays the recovery account after a 0.05 NEAR deductible.",
    links: [{ label: "Final payout receipt", hash: run.hashes.payout }],
  },
];

export function CliRun() {
  return (
    <section className="demo-panel demo-run" id="cli-run" tabIndex={-1} aria-labelledby="cli-run-heading">
      <h2 id="cli-run-heading">0.25 NEAR CLI replay</h2>
      <p>Follow one policy on NEAR testnet, from enforcing a spending rule to paying a claim for a separate simulated loss.</p>
      <dl className="demo-run-summary">
        <div><dt>Payment blocked</dt><dd>0.01 NEAR attempted</dd></div>
        <div><dt>Approved supplier paid</dt><dd>0.05 NEAR sent</dd></div>
        <div className="demo-run-paid"><dt>Claim reimbursed</dt><dd>0.25 NEAR paid</dd></div>
      </dl>
      <h3>CLI transaction receipts</h3>
      <ol className="demo-run-trail" role="list">
        {steps.map(({ title, result, links }) => (
          <li key={title}>
            <div><strong>{title}</strong><p className="demo-description">{result}</p></div>
            <div className="demo-run-links">
              {links.map(({ label, hash }) => (
                <a className="demo-proof" key={hash} href={receiptUrl(hash)}>{label}</a>
              ))}
            </div>
          </li>
        ))}
      </ol>
      <details className="demo-run-details">
        <summary>Policy and account IDs</summary>
        <dl className="demo-run-accounts">
          <div><dt>Claim ID</dt><dd className="demo-id">{run.vault}/{run.policy}</dd></div>
          <div><dt>Approved supplier</dt><dd className="demo-id">{run.supplier}</dd></div>
          <div><dt>Simulated loss recipient</dt><dd className="demo-id">{run.incidentRecipient}</dd></div>
          <div><dt>Recovery account</dt><dd className="demo-id">{run.beneficiary}</dd></div>
        </dl>
      </details>
    </section>
  );
}
