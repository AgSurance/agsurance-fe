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

export default async function DemoPage({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  const hosted = process.env.VERCEL === "1";
  const enabled = hostedDemoEnabled();
  const session = enabled && !!inviteAccounts((await cookies()).get(demoCookie)?.value);
  const live = !hosted || session;
  const invalidInvite = enabled && !session && (await searchParams).invite === "invalid";

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
        <p>Follow two completed claims on NEAR testnet. The receipts are public and open without a wallet or invite code.</p>
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
        <>
          {enabled && <section className="demo-panel demo-invite" id="live-demo" tabIndex={-1} aria-labelledby="invite-heading">
            <h2 id="invite-heading">Run a demo with an invite</h2>
            <p>Use your invite code to open a funded testnet account. You can run the demo in this browser.</p>
            <form className="demo-mandate" action="/api/demo/session" method="post">
              <label htmlFor="demo-invite">Invite code</label>
              <input id="demo-invite" name="code" type="password" autoComplete="off" required maxLength={64}
                aria-invalid={invalidInvite || undefined} aria-describedby={invalidInvite ? "invite-error" : undefined} />
              {invalidInvite && <p id="invite-error" role="alert">This invite code did not match. Check the code and try again.</p>}
              <button type="submit">Start live demo</button>
            </form>
          </section>}
          <section className="demo-panel" aria-labelledby="replay-heading">
            <h2 id="replay-heading">Replay the shared reserve claim</h2>
            <p>See a separate testnet scenario where a reserve shortfall held up reimbursement. No wallet or sign-in required.</p>
            <a className="demo-proof" href={reserveReplayUrl}>Open the interactive replay</a>
          </section>
        </>
      )}
      <DuplicateInvoice />
    </main>
  );
}
