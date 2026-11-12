import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { reserveReplayUrl } from "../../lib/demo-links";
import { demoCookie, hostedDemoEnabled, hostedRecoveryPreview, inviteAccounts } from "../../lib/hosted-demo";
import { DemoConsole } from "./demo-console";
import { CliRun } from "./cli-run";
import { DuplicateInvoice } from "./duplicate-invoice";
import { HistoricalLimit } from "./historical-limit";
import { ManualDemo } from "./manual-demo";
import { manualDemoContracts } from "../../lib/manual-demo";
import "./demo.css";

export default async function DemoPage() {
  const hosted = process.env.VERCEL === "1";
  const session = hostedDemoEnabled() && !!inviteAccounts((await cookies()).get(demoCookie)?.value);
  const live = !hosted || session;

  return (
    <main className="demo-page">
      <header className="demo-header">
        <Link className="brand" href="/">
          <Image src="/agsurance-logo.png" width={28} height={28} alt="" />
          AgSurance
        </Link>
        <span>NEAR TESTNET</span>
      </header>
      <section className="demo-intro">
        <h1>From policy to payout</h1>
        <p>Open the public transaction receipts for two completed claims on NEAR testnet.</p>
      </section>
      <CliRun />
      <HistoricalLimit />
      <ManualDemo {...manualDemoContracts()} />
      {live && (
        <div id="live-demo" tabIndex={-1}>
          <DemoConsole hosted={hosted} recoveryPreview={hostedRecoveryPreview()} />
        </div>
      )}
      {!live && (
        <section className="demo-panel" aria-labelledby="replay-heading">
          <h2 id="replay-heading">Replay the shared reserve claim</h2>
          <p>See a separate testnet scenario where a reserve shortfall held up reimbursement. No wallet or sign-in required.</p>
          <a className="demo-proof" href={reserveReplayUrl}>Open the interactive replay</a>
        </section>
      )}
      <DuplicateInvoice />
    </main>
  );
}
