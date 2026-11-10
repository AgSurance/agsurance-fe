import { cookies } from "next/headers";
import Link from "next/link";
import { demoCookie, hostedDemoEnabled, inviteAccounts } from "../../lib/hosted-demo";
import { DemoConsole } from "./demo-console";
import "./demo.css";

export default async function DemoPage({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  const hosted = process.env.VERCEL === "1";
  const enabled = hostedDemoEnabled();
  const session = enabled && !!inviteAccounts((await cookies()).get(demoCookie)?.value);
  const live = !hosted || session;
  const invalidInvite = enabled && !session && (await searchParams).invite === "invalid";

  return (
    <main className="demo-page">
      <header className="demo-header"><Link href="/">AgSurance</Link><span>NEAR TESTNET</span></header>
      <section className="demo-intro">
        <p className="eyebrow"><span /> {live || enabled ? "LIVE COVERAGE DEMO" : "PUBLIC CLAIM REPLAY"}</p>
        <h1>From policy to <em>payout.</em></h1>
        <p>{live || enabled
          ? "Buy a policy, simulate a loss, and follow the claim through to a new payout on NEAR testnet."
          : "Follow a completed claim and view its receipts on NEAR testnet."}</p>
      </section>
      {live ? <DemoConsole hosted={hosted} /> : (
        <>
          {enabled && <section className="demo-panel" aria-labelledby="invite-heading">
            <h2 id="invite-heading">Open your testnet demo</h2>
            <p>Use your invite code to open a funded testnet account. You can run the demo in this browser.</p>
            <form className="demo-mandate" action="/api/demo/session" method="post">
              <label htmlFor="demo-invite">Invite code</label>
              <input id="demo-invite" name="code" type="password" autoComplete="off" required maxLength={64} />
              <button type="submit">Start live demo</button>
            </form>
            {invalidInvite && <p role="alert" className="demo-error">This invite code did not match. Check the code and try again.</p>}
          </section>}
          <section className="demo-panel" aria-labelledby="replay-heading">
            <h2 id="replay-heading">Replay a testnet claim</h2>
            <p>No wallet or sign-in required.</p>
            <a className="demo-proof" href="https://agsurance.github.io/agsurance-fe/">Open the interactive replay</a>
          </section>
        </>
      )}
    </main>
  );
}
