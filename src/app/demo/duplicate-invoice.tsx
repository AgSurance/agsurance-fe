"use client";

import { useState } from "react";

const invoice = { id: "INV-1042", supplier: "Demo supplier", amount: 5 };
const mandate = { supplier: invoice.supplier, limit: 12 };
const agentRequests = [invoice, invoice];

function near(cents: number) {
  return `${(cents / 100).toFixed(2)} NEAR`;
}

function simulate(checkInvoiceId: boolean) {
  const paidInvoices = new Set<string>();
  let spent = 0;
  const payments = agentRequests.map((request) => {
    if (request.supplier !== mandate.supplier || spent + request.amount > mandate.limit) {
      return "Blocked by mandate";
    }
    if (checkInvoiceId && paidInvoices.has(request.id)) {
      return "Blocked as duplicate";
    }
    spent += request.amount;
    paidInvoices.add(request.id);
    return "Paid";
  });
  return { payments, spent, overpayment: Math.max(0, spent - invoice.amount) };
}

export function DuplicateInvoice() {
  const [result, setResult] = useState<{
    mandateOnly: ReturnType<typeof simulate>;
    withInvoiceCheck: ReturnType<typeof simulate>;
  } | null>(null);

  return (
    <details className="demo-panel demo-invoice" id="duplicate-invoice">
      <summary>Duplicate invoice simulation (optional)</summary>
      <p>A scripted agent stands in for one affected by prompt injection. It requests two payments for one invoice. The simulation runs in your browser with a mock ledger.</p>
      <dl className="demo-run-summary">
        <div><dt>Approved supplier</dt><dd>{invoice.supplier}</dd></div>
        <div><dt>Invoice {invoice.id}</dt><dd>{near(invoice.amount)} due</dd></div>
        <div><dt>Total spending limit</dt><dd>{near(mandate.limit)}</dd></div>
      </dl>
      <div className="demo-actions">
        <button
          type="button"
          aria-controls="duplicate-invoice-result"
          onClick={() => setResult(result ? null : { mandateOnly: simulate(false), withInvoiceCheck: simulate(true) })}
        >
          {result ? "Reset simulation" : "Run invoice simulation"}
        </button>
      </div>
      <div id="duplicate-invoice-result">
        <p role="status">
          {result
            ? `Overpayment of ${near(result.mandateOnly.overpayment)} with the current mandate. The proposed invoice check prevents it.`
            : ""}
        </p>
        {result && (
          <>
            <div className="demo-invoice-results">
              {([
                ["Current mandate", result.mandateOnly],
                ["Proposed invoice check", result.withInvoiceCheck],
              ] as const).map(([title, run]) => (
                <div key={title}>
                  <h3>{title}</h3>
                  <ol className="demo-run-trail" role="list">
                    {run.payments.map((decision, index) => (
                      <li key={index}>
                        <span>Request {index + 1} · {invoice.id} · {near(invoice.amount)}</span>
                        <strong>{decision}</strong>
                      </li>
                    ))}
                  </ol>
                  <p className="demo-description">{near(run.spent)} paid in the simulation</p>
                </div>
              ))}
            </div>
            <p className="demo-description"><strong>Current policy payout: {near(0)}.</strong> The policy requires a mandate breach. Both payments go to the approved supplier and their total is within the spending limit.</p>
          </>
        )}
      </div>
      <a className="demo-proof" href="#cli-run">See the separate testnet claim and payout receipts</a>
    </details>
  );
}
