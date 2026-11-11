import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { KeyPair } from "@near-js/crypto";
import { baseEncode } from "@near-js/utils";

const sandboxModule = process.env.AGSURANCE_SANDBOX_MODULE ?? "near-sandbox";
const { Sandbox, GenesisAccount } = await import(sandboxModule);
const root = GenesisAccount.createDefault("demo.testnet");
const sandbox = await Sandbox.start({ config: { additionalAccounts: [root] } });

try {
  process.env.AGSURANCE_TESTNET_RPC = sandbox.rpcUrl;
  const { actions, call, milliNear, readDashboard, rpc, transact, view, TransactionFailedError } = await import("../src/lib/demo-near");
  const { verifyLossEvidence } = await import("../src/lib/claim-evidence");
  const { policyQuote } = await import("../src/app/demo/policy-quote");
  const { fullBalanceEstimate } = await import("../src/lib/coverage-estimate");
  const signer = { id: root.accountId as string, key: root.privateKey as string };
  const amount = (millis: number) => String(BigInt(millis) * milliNear);
  const wasmDir = resolve(process.env.AGSURANCE_WASM_DIR ?? "../agsurance-sc/target/wasm32-unknown-unknown/release");
  const wasm = (name: string) => readFile(resolve(wasmDir, name + ".wasm"));
  async function account(label: string, code?: string, args?: object) {
    const id = label + "." + signer.id;
    const key = KeyPair.fromRandom("ed25519");
    await transact(signer, id, [
      actions.createAccount(), actions.transfer(BigInt(amount(20_000))), actions.addKey(key.getPublicKey(), actions.fullAccessKey()),
      ...(code ? [actions.deployContract(await wasm(code))] : []), ...(args ? [call("new", args)] : []),
    ]);
    return { id, key: key.toString() };
  }

  function send(actor: typeof signer, target: string, method: string, args: object = {}, deposit = "0", gas = 75) {
    return transact(actor, target, [actions.functionCall(method, args, BigInt(gas) * BigInt(10) ** BigInt(12), BigInt(deposit))]);
  }
  const pool = await account("pool", "reserve_pool", { operator: signer.id });
  const factory = await account("f", "manual_demo_factory", {
    reserve: pool.id, runner: signer.id, reviewers: ["r1.demo.testnet", "r2.demo.testnet", "r3.demo.testnet"],
    incident_recipient: "loss.demo.testnet", wallet_code_hash: baseEncode(createHash("sha256").update(await wasm("agent_wallet")).digest()),
    risk_group: "shared-wallet-runtime",
  });
  const lossRecipient = await account("loss");
  const supplier = await account("supplier");
  const r1 = await account("r1");
  const r2 = await account("r2");
  await account("r3");
  const owner1 = await account("buyer1");
  const owner2 = await account("buyer2");
  const owner3 = await account("buyer3");
  const provider1 = await account("capital1");
  const provider2 = await account("capital2");
  const provider3 = await account("capital3");

  await send(signer, pool.id, "configure_capital_pilot", {
    validator: lossRecipient.id, buffer: amount(100), delegation_cap: amount(100), capital_bps: 7000, cashback_bps: 2000,
  });
  await send(signer, pool.id, "configure_rolling_limits", { max_policy: amount(500), max_group: amount(690), registrar: factory.id });
  const setupDeposit = await view<string>(factory.id, "setup_deposit");
  async function setup(owner: typeof signer) {
    await send(owner, factory.id, "prepare", {}, setupDeposit, 255);
    const result = await view<{ stage: string; vault: string; wallet: string }>(factory.id, "setup", { owner: owner.id });
    assert.equal(result.stage, "Ready");
    return result;
  }
  process.env.AGSURANCE_MANUAL_FACTORY = factory.id;
  process.env.AGSURANCE_MANUAL_CAPITAL_POOL = "legacy.demo.testnet";
  const { GET } = await import("../src/app/api/manual-demo/route");
  const snapshot = async (account: string) => {
    const response = await GET(new Request("http://localhost/api/manual-demo?account=" + account));
    assert.equal(response.status, 200);
    const result: import("../src/lib/manual-demo").ManualSnapshot = await response.json();
    assert.deepEqual(result.errors, []);
    assert.equal(result.fundingPool, pool.id);
    return result;
  };
  const a = await setup(owner1);
  const b = await setup(owner2);
  const c = await setup(owner3);
  const status = () => view<import("../src/lib/demo-state").ReserveStatus>(pool.id, "reserve_status");
  const buy = (owner: typeof signer, target: string, limit: number, funding: number) =>
    send(owner, target, "buy_policy", {
      expected_policy_id: 0, supplier: supplier.id, limit: amount(50), coverage_limit: amount(limit), wallet_funding: amount(funding),
    }, (BigInt(amount(funding)) + BigInt(amount(limit)) / BigInt(40)).toString(), 170);

  // Start a short policy while the shared-reserve checks run. Its first paid window will lapse.
  const shortWindowSeconds = 30;
  const shortPool = await account("short-pool", "reserve_pool", { operator: signer.id });
  const shortWallet = await account("short-wallet", "agent_wallet", {
    vault: "short-vault.demo.testnet", runner: signer.id, recipient: lossRecipient.id,
  });
  const shortVault = await account("short-vault", "coverage_vault", {
    owner: owner3.id, beneficiary: owner3.id, wallet: shortWallet.id, runner: signer.id,
    reviewers: [r1.id, r2.id, "r3.demo.testnet"], reserve_pool: shortPool.id,
    test_window_seconds: shortWindowSeconds,
  });
  await send(signer, shortPool.id, "register_vault", { vault: shortVault.id, beneficiary: owner3.id });
  await send(signer, shortPool.id, "fund_reserve", {}, amount(1_000));
  await send(owner3, shortVault.id, "buy_policy", {
    supplier: supplier.id, limit: amount(50), expected_policy_id: 0,
  }, amount(360), 170);
  assert.equal((await readDashboard(shortVault.id)).coverage?.active, true);

  await send(provider1, pool.id, "fund_capital_pilot", {}, amount(400));
  assert.equal((await status()).available, amount(300));
  const quoted = await snapshot(owner1.id);
  const quote = policyQuote(quoted.dashboard!, quoted.poolCapacity!, "buy", "0.5", "");
  assert.equal(quote.recommended.toString(), amount(450));
  assert.equal(quote.maximum.toString(), amount(300));
  await buy(owner1, a.vault, 180, 500);
  assert.equal((await status()).locked, amount(180));
  await assert.rejects(buy(owner2, b.vault, 200, 500), TransactionFailedError);
  assert.equal((await readDashboard(b.vault)).policy, null);
  console.log("PASS: Checkout rejected when liquid capacity was insufficient.");

  await send(provider2, pool.id, "fund_capital_pilot", {}, amount(600));
  assert.equal((await status()).available, amount(720));
  assert.equal((await snapshot(owner1.id)).dashboard!.limit, amount(180));
  await assert.rejects(buy(owner3, c.vault, 510, 650), TransactionFailedError);
  await send(owner2, b.wallet, "top_up", {}, amount(500));
  await buy(owner2, b.vault, 200, 0);
  assert.equal((await readDashboard(b.vault)).operatingBalance, amount(500));
  assert.equal((await status()).locked, amount(380));
  console.log("PASS: A new deposit opened capacity and the second policy activated.");
  await assert.rejects(buy(owner3, c.vault, 320, 500), TransactionFailedError);

  // Wallet funding alone does not update policy terms.
  await send(owner1, a.wallet, "top_up", {}, amount(300));
  assert.equal((await readDashboard(a.vault)).limit, amount(180));
  const change = (limit: number, expected = 180) => send(owner1, a.vault, "request_limit_increase",
    { policy_id: 1, expected_limit: amount(expected), limit: amount(limit) },
    (BigInt(amount(limit - expected)) / BigInt(40)).toString(), 105);
  await assert.rejects(change(500), TransactionFailedError);
  assert.equal((await readDashboard(a.vault)).limit, amount(180));
  assert.equal((await status()).locked, amount(380));

  // Record a loss before the increase, then file it afterwards.
  const loss = await send(signer, a.wallet, "simulate_loss", { policy_id: 1 });
  const incident = (await readDashboard(a.vault)).incident!;
  assert(incident);
  await send(owner1, a.wallet, "top_up", {}, amount(600));
  await change(420);
  const upgraded = await snapshot(owner1.id);
  assert.equal(upgraded.dashboard!.limit, amount(420));
  assert.equal(upgraded.dashboard!.premium, String(BigInt(amount(420)) / BigInt(40)));
  assert.equal(upgraded.poolReserve!.locked, amount(620));
  assert.equal(upgraded.poolCapacity!.group_remaining, amount(70));
  await assert.rejects(change(500, 420), TransactionFailedError);

  const key = KeyPair.fromRandom("ed25519");
  await send(owner1, a.vault, "connect_agent", { policy_id: 1, public_key: key.getPublicKey().toString() }, amount(100), 90);
  const agent = { id: (await readDashboard(a.vault)).agent!.account_id, key: key.toString() };
  await send(agent, a.vault, "submit_claim", { policy_id: 1 });
  const evidence = await verifyLossEvidence({ ...(await snapshot(owner1.id)).dashboard!, runner: signer.id }, loss.hash);
  await send(r1, a.vault, "approve_claim", { policy_id: 1, evidence });
  await send(r2, a.vault, "approve_claim", { policy_id: 1, evidence });
  assert.equal((await readDashboard(a.vault)).policy!.payout, amount(180));
  const balance = async () => (await rpc<{ amount: string }>("query", {
    request_type: "view_account", finality: "final", account_id: owner1.id,
  })).amount;
  const before = await balance();
  const paid = await send(signer, a.vault, "pay_claim", { policy_id: 1 });
  assert(BigInt(await balance()) - BigInt(before) === BigInt(amount(180)));
  assert.equal((await status()).locked, amount(200));
  assert.equal((await status()).assets, amount(820));
  assert.equal((await snapshot(owner1.id)).poolCapacity!.group_remaining, amount(490));
  console.log("PASS: The limit rose from 0.18 to 0.42 NEAR, but the earlier loss paid 0.18 NEAR.");

  const equity = async (id: string) => (await snapshot(id)).capital!.account_share!.equity!;
  const beforeShares = [await equity(provider1.id), await equity(provider2.id)];
  await send(provider3, pool.id, "fund_capital_pilot", {}, amount(820));
  assert.deepEqual([await equity(provider1.id), await equity(provider2.id)], beforeShares);
  assert.equal(await equity(provider3.id), amount(820));
  assert.equal(fullBalanceEstimate("1000")!.premium.toString(), amount(23340));
  console.log("PASS: New capital bought shares at post-claim equity without reducing prior providers' equity.");
  console.log("Local Sandbox payout transaction:", paid.hash);

  const expiresBy = Date.now() + 35_000;
  while ((await readDashboard(shortVault.id)).coverage?.active) {
    assert(Date.now() < expiresBy, "The short paid coverage window did not lapse.");
    await delay(500);
  }
  const uncoveredLoss = await send(signer, shortWallet.id, "simulate_loss", { policy_id: 1 });
  await send(owner3, shortVault.id, "submit_claim", { policy_id: 1 });
  const filed = await readDashboard(shortVault.id);
  assert.equal(filed.policy?.phase, "InReview");
  const uncoveredEvidence = await verifyLossEvidence({
    ...filed, vault: shortVault.id, wallet: shortWallet.id, runner: signer.id,
    incident: filed.incident ?? null, demoOwner: true,
  }, uncoveredLoss.hash);
  const paidWindowStart = filed.policy?.windows?.[0];
  assert(paidWindowStart != null && uncoveredEvidence.block_timestamp_ms !== undefined);
  assert(uncoveredEvidence.block_timestamp_ms >= (paidWindowStart + shortWindowSeconds) * 1_000);

  const reserveBefore = filed.reserveStatus;
  assert(reserveBefore);
  assert.equal(reserveBefore.assets, amount(1_000));
  assert.equal(reserveBefore.locked, amount(400));
  await send(r1, shortVault.id, "reject_claim", { policy_id: 1, evidence: uncoveredEvidence });
  assert.equal((await readDashboard(shortVault.id)).policy?.phase, "InReview");
  await send(r2, shortVault.id, "reject_claim", { policy_id: 1, evidence: uncoveredEvidence });
  assert.equal((await readDashboard(shortVault.id)).policy?.phase, "Rejected");
  await assert.rejects(
    send(signer, shortVault.id, "pay_claim", { policy_id: 1 }),
    TransactionFailedError,
  );
  const afterPayoutAttempt = await readDashboard(shortVault.id);
  assert.equal(afterPayoutAttempt.policy?.phase, "Rejected");
  assert.deepEqual(afterPayoutAttempt.reserveStatus, reserveBefore);
  console.log("PASS: Two reviewers rejected a loss after paid coverage lapsed. The payout was blocked and reserve assets stayed at 1.00 NEAR.");
} finally {
  await sandbox.tearDown();
}
