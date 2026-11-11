"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { NearConnector, NearWalletBase } from "@hot-labs/near-connect";
import { formatNear } from "../../lib/coverage-estimate";
import { CHECKOUT_GAS, checkoutTotal, parseNear, projectStatus, TESTNET_RPC } from "../../lib/demo-state";
import type { ManualSnapshot } from "../../lib/manual-demo";
import { AgentSetup } from "./agent-setup";
import { CapitalProvider } from "./capital-provider";
import { policyQuote } from "./policy-quote";

const faucet = "https://near-faucet.io/";
const explorer = "https://testnet.nearblocks.io/txns/";
const namedAccount = /^[a-z0-9]+(?:[._-][a-z0-9]+)*\.testnet$/;
type Role = "buyer" | "capital";
const pendingKey = (account: string) => `agsurance-manual-transaction-${account}`;

export function ManualDemo({ factory, capitalPool, supplier }: {
  factory?: string; capitalPool?: string; supplier?: string;
}) {
  const connector = useRef<NearConnector | null>(null);
  const [connection, setConnection] = useState<{ wallet: NearWalletBase; account: string }>();
  const [snapshot, setSnapshot] = useState<ManualSnapshot>();
  const [role, setRole] = useState<Role>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [lastHash, setLastHash] = useState<string>();
  const [checking, setChecking] = useState(false);
  const [recipient, setRecipient] = useState(supplier ?? "");
  const [limitInput, setLimit] = useState("0.05");
  const [publicKey, setPublicKey] = useState("");
  const [funding, setFunding] = useState("0.35");
  const [desiredLimit, setDesiredLimit] = useState("");
  const [increaseLimit, setIncreaseLimit] = useState("");
  const [topUp, setTopUp] = useState("");
  const account = connection?.account;

  const refresh = useCallback(async (id: string, signal?: AbortSignal) => {
    const response = await fetch(`/api/manual-demo?${new URLSearchParams({ account: id })}`, { cache: "no-store", signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    if (!signal?.aborted) setSnapshot(data);
  }, []);

  useEffect(() => {
    if (!account) return;
    const controller = new AbortController();
    const update = () => void refresh(account, controller.signal).catch(() => undefined);
    const timer = window.setInterval(update, 8000);
    return () => { window.clearInterval(timer); controller.abort(); };
  }, [account, refresh]);

  async function connect() {
    setBusy(true);
    setNotice("");
    try {
      if (!connector.current) {
        const { NearConnector } = await import("@hot-labs/near-connect");
        connector.current = new NearConnector({ network: "testnet", autoConnect: false, providers: { testnet: [TESTNET_RPC] } });
      }
      const wallet = await connector.current.connect();
      const [selected] = await wallet.getAccounts({ network: "testnet" });
      if (!selected) throw new Error("Select an account on NEAR testnet.");
      await refresh(selected.accountId);
      setConnection({ wallet, account: selected.accountId });
      try {
        const pending = localStorage.getItem(pendingKey(selected.accountId));
        if (pending) {
          setLastHash(pending);
          setChecking(true);
          setNotice("Check your previous transaction before signing again.");
        }
      } catch { /* The connected wallet remains usable when storage is unavailable. */ }
    } catch (error) { setNotice((error as Error).message); }
    finally { setBusy(false); }
  }

  async function disconnect() {
    if (!connection) return;
    setBusy(true);
    try {
      await connector.current?.disconnect(connection.wallet);
      setConnection(undefined);
      setSnapshot(undefined);
      setRole(undefined);
      setChecking(false);
      setLastHash(undefined);
      setPublicKey("");
      setNotice("");
    } catch (error) { setNotice((error as Error).message); }
    finally { setBusy(false); }
  }

  async function checkTransaction(id: string, hash: string) {
    const query = new URLSearchParams({ account: id, transaction: hash });
    const response = await fetch(`/api/manual-demo?${query}`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    if (result.status === "pending") {
      setNotice("The transaction is pending on NEAR testnet. Check it before signing again.");
      return;
    }
    await refresh(id);
    setChecking(false);
    try { localStorage.removeItem(pendingKey(id)); } catch { /* Keep the confirmed result visible. */ }
    setNotice(result.status === "confirmed" ? "Transaction confirmed on NEAR testnet."
      : "The operation did not complete. Check the receipt and the current account status.");
  }

  async function sign(target: string, methodName: string, args: Record<string, unknown>, deposit: string, gas: string) {
    if (!connection || busy || checking) return;
    setBusy(true);
    setNotice("");
    try {
      const result = await connection.wallet.signAndSendTransaction({
        network: "testnet", signerId: connection.account, receiverId: target,
        actions: [{ type: "FunctionCall", params: { methodName, args, gas, deposit } }],
      });
      const hash = result?.transaction?.hash;
      if (typeof hash === "string") {
        setLastHash(hash);
        setChecking(true);
        try { localStorage.setItem(pendingKey(connection.account), hash); } catch { /* Keep the pending result in this session. */ }
        await checkTransaction(connection.account, hash);
      } else {
        await refresh(connection.account);
        setNotice("Check the result in your wallet and refresh the on-chain status.");
      }
    } catch (error) { setNotice((error as Error).message); }
    finally { setBusy(false); }
  }

  const dashboard = snapshot?.dashboard;
  const setup = snapshot?.setup;
  const terms = dashboard && projectStatus(dashboard);
  const maxFundedLoss = dashboard && BigInt((dashboard.policy ? dashboard.operatingBalance : dashboard.wallet_funding) ?? "0");
  const pool = snapshot?.fundingPool ?? capitalPool;
  const capacity = snapshot?.poolCapacity;
  const canUseCapacity = !!dashboard?.rolling && dashboard.reserve_pool === pool && !!capacity;
  const buyQuote = dashboard && canUseCapacity ? policyQuote(dashboard, capacity, "buy", funding, desiredLimit) : null;
  const increaseQuote = dashboard && canUseCapacity ? policyQuote(dashboard, capacity, "increase", "0", increaseLimit) : null;
  const topUpAmount = parseNear(topUp);
  const hasTopUp = topUpAmount !== undefined && BigInt(topUpAmount) > BigInt(0);
  const deductible = BigInt(dashboard?.deductible ?? "0");
  const maximum = BigInt(dashboard?.limit ?? "0");
  const payableLoss = maxFundedLoss && maxFundedLoss > deductible ? maxFundedLoss - deductible : BigInt(0);
  const fundedPayout = payableLoss > maximum ? maximum : payableLoss;
  const limit = parseNear(limitInput);
  const validMandate = recipient.length <= 64 && namedAccount.test(recipient) && recipient !== dashboard?.wallet && recipient !== dashboard?.vault
    && !!limit && BigInt(limit) > BigInt(0) && BigInt(limit) <= BigInt(dashboard?.max_supplier_limit ?? "0");
  const ready = !busy && !checking;
  const checkout = dashboard?.checkout;

  return (
    <>
      <section className="demo-panel demo-manual" id="manual-demo" aria-labelledby="manual-demo-heading">
        <h2 id="manual-demo-heading">Try AgSurance with your wallet</h2>
        <p>Connect a NEAR testnet wallet to set up an insured agent account or fund the capital pilot.</p>
        <p><a className="demo-proof" href={faucet}>Get testnet NEAR from the faucet</a> · <a className="demo-proof" href="#cli-run">View a completed demo</a></p>

        {!account ? <button className="demo-manual-button" type="button" disabled={busy} onClick={() => void connect()}>Connect Wallet</button> : (
          <>
            <div className="demo-actions">
              <span className="demo-id">{account}</span>
              <button className="demo-secondary" type="button" disabled={busy} onClick={() => void disconnect()}>Disconnect</button>
            </div>
            <div className="demo-actions" aria-label="Choose a role">
              <button type="button" aria-pressed={role === "buyer"} onClick={() => setRole("buyer")}>Buy a policy</button>
              <button type="button" aria-pressed={role === "capital"} onClick={() => setRole("capital")}>Provide capital</button>
            </div>
          </>
        )}
        <div aria-live="polite">
          {notice && <p>{notice}</p>}
          {snapshot?.errors.map(error => <p key={error}>{error}</p>)}
          {lastHash && <a className="demo-proof" href={`${explorer}${lastHash}/receipts`}>View wallet transaction</a>}
        </div>
        {account && <div className="demo-actions">
          <button className="demo-secondary" type="button" disabled={busy} onClick={async () => {
            setBusy(true);
            try { if (checking && lastHash) await checkTransaction(account, lastHash); else await refresh(account); }
            catch (error) { setNotice((error as Error).message); }
            finally { setBusy(false); }
          }}>{checking ? "Check transaction" : "Refresh testnet status"}</button>
        </div>}

        {account && role === "capital" && <CapitalProvider capital={snapshot?.capital} pool={pool} busy={!ready}
          reserve={snapshot?.poolReserve}
          onDeposit={amount => { if (pool) void sign(pool, "fund_capital_pilot", {}, amount, "30000000000000"); }} />}

        {account && role === "buyer" && <div className="demo-manual-flow">
          <h3>{dashboard?.policy ? "Your policy dashboard" : "Set up your agent wallet"}</h3>
          <p>See your funded balance, premium, payout limit, and claim status. Set an approved supplier and grant a separate key to your agent after checkout.</p>
          {!namedAccount.test(account) && <p>Use a named testnet account to buy a policy.</p>}
          {!factory && <p>Manual checkout is currently unavailable.</p>}
          {factory && namedAccount.test(account) && !dashboard && setup?.stage !== "Ready" && snapshot?.setupDeposit && (
            <>
              <p>{setup ? "Your setup deposit is already on chain." : `One-time setup deposit for contract storage: ${formatNear(snapshot.setupDeposit)} plus gas.`}</p>
              {setup?.pending && <p>NEAR is preparing your wallet and coverage vault.</p>}
              <button type="button" disabled={!ready || !!setup?.pending}
                onClick={() => void sign(factory, "prepare", {}, setup ? "0" : snapshot.setupDeposit!, "255000000000000")}>
                {setup ? "Resume wallet setup" : "Set up insured wallet"}
              </button>
            </>
          )}

          {dashboard && <>
            {(!dashboard.rolling || dashboard.policy) && <dl className="demo-amounts demo-manual-amounts">
              <div><dt>{dashboard.policy ? "Agent wallet balance" : "Agent funding at checkout"}</dt><dd>{formatNear(maxFundedLoss || "0")}</dd></div>
              <div><dt>On-chain payout limit</dt><dd>{formatNear(dashboard.limit)}</dd></div>
              <div><dt>Deductible</dt><dd>{formatNear(dashboard.deductible)}</dd></div>
              <div><dt>Payout if the entire balance is lost in an eligible claim</dt><dd>{formatNear(fundedPayout)}</dd></div>
              <div><dt>{dashboard.policy ? "Weekly premium" : "First weekly premium"}</dt><dd>{formatNear(dashboard.premium)}</dd></div>
              {!dashboard.rolling && !dashboard.policy && <div><dt>Checkout total, plus gas</dt><dd>{formatNear(checkoutTotal(dashboard))}</dd></div>}
              {dashboard.policy && <div><dt>Claim and policy status</dt><dd>{dashboard.policy.phase}</dd></div>}
            </dl>}
            <p className="demo-id">Vault · {dashboard.vault}</p>
            <p className="demo-id">Recovery account · {dashboard.beneficiary}</p>
            {terms?.actions.buy === "no_capacity" && <p>The reserve has insufficient capacity for a new policy.</p>}
            {terms?.actions.buy === "reserve_shortfall" && <p>Checkout is paused because the reserve has a shortfall.</p>}
            {checkout && <p>Checkout status: {checkout.phase}</p>}
            {terms?.actions.refund === "available" && <button type="button" disabled={!ready} onClick={() => void sign(
              dashboard.vault, "retry_checkout_refund", { policy_id: checkout?.policy_id }, "0", "75000000000000",
            )}>Retry checkout refund</button>}
            {dashboard.rolling && !capacity && <p>Live capacity is temporarily unavailable.</p>}
            {(terms?.actions.buy === "available" || dashboard.rolling && terms?.actions.buy === "no_capacity") && (
              <>
                {dashboard.rolling && <div className="demo-manual-fields">
                  <label>Additional wallet funding (NEAR)
                    <input value={funding} inputMode="decimal" maxLength={29} onChange={event => setFunding(event.target.value)} />
                  </label>
                  <label>Requested payout limit (NEAR)
                    <input value={desiredLimit} inputMode="decimal" maxLength={29}
                      placeholder="Use the highest available limit" onChange={event => setDesiredLimit(event.target.value)} />
                  </label>
                </div>}
                {buyQuote && <dl className="demo-amounts demo-manual-amounts">
                  <div><dt>Agent balance after funding</dt><dd>{formatNear(buyQuote.balance)}</dd></div>
                  <div><dt>Recommended limit after deductible</dt><dd>{formatNear(buyQuote.recommended)}</dd></div>
                  <div><dt>Maximum available now</dt><dd>{formatNear(buyQuote.maximum)}</dd></div>
                  <div><dt>Balance outside the maximum available payout</dt><dd>{formatNear(buyQuote.balance - buyQuote.maximum)}</dd></div>
                  <div><dt>Deductible</dt><dd>{formatNear(buyQuote.deductible)}</dd></div>
                  {buyQuote.valid && <>
                    <div><dt>Selected payout limit</dt><dd>{formatNear(buyQuote.chosen)}</dd></div>
                    {buyQuote.chosen !== buyQuote.maximum && <div><dt>Balance outside the selected payout limit</dt><dd>{formatNear(buyQuote.uncovered)}</dd></div>}
                    <div><dt>First weekly premium</dt><dd>{formatNear(buyQuote.premium)}</dd></div>
                    {buyQuote.funding > BigInt(0) && <div><dt>Funding plus premium, before gas</dt><dd>{formatNear(buyQuote.funding + buyQuote.premium)}</dd></div>}
                  </>}
                </dl>}
                {buyQuote && !buyQuote.valid && <p>Choose a valid limit within the available capacity to continue.</p>}
                <div className="demo-manual-fields">
                  <label>Approved supplier
                    <input value={recipient} maxLength={64} onChange={event => setRecipient(event.target.value)} />
                  </label>
                  <label>Supplier spending limit (NEAR)
                    <input value={limitInput} inputMode="decimal" maxLength={29} onChange={event => setLimit(event.target.value)} />
                  </label>
                </div>
                {!validMandate && <p>Enter a named testnet supplier and a positive limit up to {formatNear(dashboard.max_supplier_limit ?? "0")}.</p>}
                <button type="button" disabled={!ready || !validMandate || terms?.actions.buy !== "available"
                  || (dashboard.rolling && (!buyQuote?.valid || dashboard.premiums_distributed === false && !!dashboard.policy))}
                  onClick={() => void sign(
                    dashboard.vault, "buy_policy", {
                      supplier: recipient, limit, expected_policy_id: dashboard.policy?.id ?? 0,
                      ...(buyQuote && { coverage_limit: buyQuote.chosen.toString(), wallet_funding: buyQuote.funding.toString() }),
                    },
                    buyQuote ? (buyQuote.premium + buyQuote.funding).toString() : checkoutTotal(dashboard),
                    buyQuote ? "170000000000000" : CHECKOUT_GAS,
                  )}>{buyQuote?.funding === BigInt(0) ? "Buy policy" : "Fund wallet and buy policy"}</button>
              </>
            )}
            {dashboard.rolling && dashboard.policy?.phase === "Active" && !dashboard.coverage?.retired && <>
              <div className="demo-manual-fields">
                <label>Add NEAR to the agent wallet
                  <input value={topUp} inputMode="decimal" maxLength={29} onChange={event => setTopUp(event.target.value)} />
                </label>
                <button type="button" disabled={!ready || !hasTopUp || !!dashboard.limit_increase}
                  onClick={() => void sign(dashboard.wallet, "top_up", {}, topUpAmount!, "30000000000000")}>Add wallet funds</button>
              </div>
              {dashboard.limit_increase ? <div>
                <p>Limit increase to {formatNear(dashboard.limit_increase.limit)}: {dashboard.limit_increase.stage}.</p>
                <button type="button" disabled={!ready || dashboard.limit_increase.stage === "Refunding"
                  || dashboard.limit_increase.stage !== "RefundAvailable" && (dashboard.blockHeight ?? 0) < dashboard.limit_increase.retry_height}
                  onClick={() => void sign(dashboard.vault, "resume_limit_increase", { id: dashboard.limit_increase!.id }, "0", "105000000000000")}>
                  {dashboard.limit_increase.stage === "RefundAvailable" ? "Retry premium refund" : "Resume increase request"}
                </button>
              </div> : increaseQuote && dashboard.coverage?.active && !dashboard.coverage.renewal_pending && <>
                <h4>Increase your payout limit</h4>
                <p>Your current limit stays in effect until an increase is confirmed. New limits apply to future losses.</p>
                <dl className="demo-amounts demo-manual-amounts">
                  <div><dt>Recommended limit after deductible</dt><dd>{formatNear(increaseQuote.recommended)}</dd></div>
                  <div><dt>Maximum limit available now</dt><dd>{formatNear(increaseQuote.maximum > increaseQuote.existing ? increaseQuote.maximum : increaseQuote.existing)}</dd></div>
                </dl>
                {increaseQuote.maximum > increaseQuote.existing && <>
                  <div className="demo-manual-fields">
                    <label>New payout limit (NEAR)
                      <input value={increaseLimit} inputMode="decimal" maxLength={29} placeholder="Use the highest available limit"
                        onChange={event => setIncreaseLimit(event.target.value)} />
                    </label>
                  </div>
                  {increaseQuote.valid && <p>Pay {formatNear(increaseQuote.addedFee)} for the increase across already paid windows.
                    Future weekly premiums will be {formatNear(increaseQuote.premium)}.</p>}
                  <button type="button" disabled={!ready || !increaseQuote.valid} onClick={() => void sign(
                    dashboard.vault, "request_limit_increase", {
                      policy_id: dashboard.policy!.id, expected_limit: dashboard.limit, limit: increaseQuote.chosen.toString(),
                    }, increaseQuote.addedFee.toString(), "105000000000000",
                  )}>Confirm higher limit</button>
                </>}
              </>}
            </>}
            {dashboard.rolling && dashboard.policy && terms?.actions.close === "available" && !dashboard.limit_increase && (
              <button type="button" disabled={!ready} onClick={() => void sign(dashboard.vault, "close_policy",
                { policy_id: dashboard.policy!.id }, "0", "75000000000000")}>Close policy and release its reserve</button>
            )}
            {dashboard.rolling && dashboard.policy && ["Paid", "Closed"].includes(dashboard.policy.phase)
              && !dashboard.premiums_distributed && !dashboard.coverage?.unused_premium
              && (dashboard.chain_time ?? 0) >= (dashboard.coverage?.term_end ?? Infinity) && (
              <button type="button" disabled={!ready || dashboard.premiums_pending}
                onClick={() => void sign(dashboard.vault, "settle_earned_premiums", { policy_id: dashboard.policy!.id }, "0", "75000000000000")}>
                Settle earned premiums
              </button>
            )}
            {dashboard.policy && terms?.actions.connect === "available" && (
              <div className="demo-manual-fields">
                <label>Agent public key
                  <input value={publicKey} maxLength={64} onChange={event => setPublicKey(event.target.value)} />
                </label>
                <a className="demo-proof" href="#agent-setup">Agent setup guide</a>
                <button type="button" disabled={!ready || !/^ed25519:[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(publicKey.trim())}
                  onClick={() => void sign(dashboard.vault, "connect_agent", { policy_id: dashboard.policy!.id, public_key: publicKey.trim() },
                    dashboard.agent_funding ?? "0", "75000000000000")}>Connect Agent</button>
              </div>
            )}
            {dashboard.agent && <p className="demo-id">{dashboard.agent.connected ? "Agent connected" : "Agent connection pending"} · {dashboard.agent.account_id}</p>}
            {dashboard.agent?.connected && dashboard.policy && terms?.actions.revoke === "available" &&
              <button type="button" disabled={!ready} onClick={() => void sign(dashboard.vault, "revoke_agent", { policy_id: dashboard.policy!.id },
                "1", "75000000000000")}>Revoke agent</button>}
          </>}
        </div>}
      </section>
      <AgentSetup vault={dashboard?.vault} funding={dashboard?.agent_funding ? formatNear(dashboard.agent_funding) : undefined} />
    </>
  );
}
