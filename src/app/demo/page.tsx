import Link from "next/link";
import { DemoConsole } from "./demo-console";
import "./demo.css";

export default function DemoPage() {
  const hosted = process.env.VERCEL === "1";
  return (
    <main className="demo-page">
      <header className="demo-header"><Link href="/">AgSurance</Link><span>NEAR TESTNET</span></header>
      <section className="demo-intro">
        <p className="eyebrow"><span /> {hosted ? "PUBLIC CLAIM REPLAY" : "LIVE COVERAGE DEMO"}</p>
        <h1>From policy to <em>payout.</em></h1>
        <p>{hosted
          ? "Follow a completed claim and verify the receipts on NEAR testnet. The live console runs locally."
          : "Buy coverage, simulate an agent wallet loss, and follow the claim until reimbursement lands on NEAR testnet."}</p>
      </section>
      {hosted ? (
        <section className="demo-panel" aria-labelledby="replay-heading">
          <h2 id="replay-heading">Replay a testnet claim</h2>
          <p>No wallet or sign-in required.</p>
          <a className="demo-proof" href="https://agsurance.github.io/agsurance-fe/">Open the interactive replay</a>
        </section>
      ) : <DemoConsole />}
    </main>
  );
}
