import Link from "next/link";
import { DemoConsole } from "./demo-console";
import "./demo.css";

export default function DemoPage() {
  return (
    <main className="demo-page">
      <header className="demo-header"><Link href="/">AgSurance</Link><span>NEAR TESTNET</span></header>
      <section className="demo-intro">
        <p className="eyebrow"><span /> LIVE COVERAGE DEMO</p>
        <h1>From policy to <em>payout.</em></h1>
        <p>Buy coverage, simulate an agent wallet loss, and follow the claim until reimbursement lands on NEAR testnet.</p>
      </section>
      <DemoConsole />
    </main>
  );
}
