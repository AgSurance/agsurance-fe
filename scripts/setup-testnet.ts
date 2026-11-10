import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { KeyPair } from "@near-js/crypto";
import { actions, call, milliNear, rpc, transact, view, type Actor, type DemoAccounts } from "../src/lib/demo-near";

const saved = process.env.AGSURANCE_DEMO_ACCOUNTS;
const existing = saved ? JSON.parse(saved) as DemoAccounts : undefined;
if (existing && !existing.pool) throw new Error("Use a fresh testnet configuration for the shared reserve.");
const baseId = existing?.owner.id ?? `agsurance-${randomBytes(4).toString("hex")}.testnet`;
const createActor = (id: string) => ({ id, key: KeyPair.fromRandom("ed25519").toString() });
const owner = existing?.owner ?? createActor(baseId);
const policyOwner = existing?.policyOwner ?? process.env.AGSURANCE_POLICY_OWNER ?? owner.id;
if (!policyOwner.endsWith(".testnet")) throw new Error("Use a named NEAR testnet wallet as policy owner.");
const runner = existing?.runner ?? createActor(`agent.${baseId}`);
const wallet = createActor(`wallet.${baseId}`);
const pool = createActor(`pool.${baseId}`);
const vault = createActor(`vault.${baseId}`);
const beneficiary = existing?.recovery ?? createActor(`recovery.${baseId}`);
const supplier = createActor(`supplier.${baseId}`);
const recipient = createActor(`incident.${baseId}`);
const reviewers = existing?.reviewers ?? [1, 2, 3].map(n => createActor(`reviewer${n}.${baseId}`)) as [Actor, Actor, Actor];
const accounts: DemoAccounts = { owner, policyOwner, supplier: supplier.id, recovery: beneficiary, runner, reviewers, wallet: wallet.id, vault: vault.id, pool: pool.id };
const wasm = process.argv[2];
if (!wasm) throw new Error("Pass the smart-contract WASM output directory");
const [walletCode, vaultCode, poolCode] = await Promise.all([
  readFile(`${wasm}/agent_wallet.wasm`), readFile(`${wasm}/coverage_vault.wasm`), readFile(`${wasm}/reserve_pool.wasm`),
]);
const keyFor = (actor: Actor) => KeyPair.fromString(actor.key as `ed25519:${string}`).getPublicKey();
if (!existing) {
  await writeFile(".env.local", `AGSURANCE_DEMO_ACCOUNTS='${JSON.stringify(accounts)}'\n`, { mode: 0o600, flag: "wx" });
}

async function accountExists(id: string) {
  try {
    await rpc("query", { request_type: "view_account", finality: "final", account_id: id });
    return true;
  } catch (error) {
    if ((error as Error).message.endsWith("UNKNOWN_ACCOUNT")) return false;
    throw error;
  }
}

if (!await accountExists(owner.id)) {
  const faucet = await fetch("https://helper.testnet.near.org/account", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ newAccountId: owner.id, newAccountPublicKey: keyFor(owner).toString() }),
    signal: AbortSignal.timeout(20000),
  });
  if (!faucet.ok) throw new Error(`Testnet account creation failed (HTTP ${faucet.status})`);
}
for (let attempt = 0; attempt < 10; attempt++) {
  try {
    await rpc("query", { request_type: "view_account", finality: "final", account_id: owner.id });
    break;
  } catch (error) {
    if (attempt === 9) throw error;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}
console.log(`Funded testnet owner ${owner.id}`);

async function createAccount(actor: Actor, balance: number, extra: ReturnType<typeof call>[] = []) {
  if (await accountExists(actor.id)) return;
  const result = await transact(owner, actor.id, [
    actions.createAccount(), actions.transfer(BigInt(balance) * milliNear),
    ...(extra.length ? extra : [actions.addKey(keyFor(actor), actions.fullAccessKey())]),
  ]);
  console.log(`${actor.id}: ${result.hash}`);
}

await createAccount(runner, 100);
await createAccount(beneficiary, 150);
await createAccount(recipient, 30);
await createAccount(supplier, 30);
for (const reviewer of reviewers) await createAccount(reviewer, 100);
await createAccount(wallet, 2500, [actions.deployContract(walletCode), call("new", { vault: vault.id, runner: runner.id, recipient: recipient.id })]);
await createAccount(pool, 2000, [actions.deployContract(poolCode), call("new", { operator: owner.id })]);
await createAccount(vault, 3200, [actions.deployContract(vaultCode), call("new", {
  owner: policyOwner, runner: runner.id, wallet: wallet.id, beneficiary: beneficiary.id, reviewers: reviewers.map(r => r.id),
  reserve_pool: pool.id,
  test_review_seconds: process.env.AGSURANCE_TEST_REVIEW_SECONDS ? Number(process.env.AGSURANCE_TEST_REVIEW_SECONDS) : null,
  test_window_seconds: process.env.AGSURANCE_TEST_WINDOW_SECONDS ? Number(process.env.AGSURANCE_TEST_WINDOW_SECONDS) : null,
})]);
if (!(await view<string | null>(pool.id, "vault_beneficiary", { vault: vault.id }))) {
  await transact(owner, pool.id, [call("register_vault", { vault: vault.id, beneficiary: beneficiary.id })]);
}
const { assets } = await view<{ assets: string }>(pool.id, "reserve_status");
if (assets === "0") {
  const reserve = await transact(owner, pool.id, [call("fund_reserve", {}, BigInt(1000) * milliNear)]);
  console.log(`Demo reserve funded: ${reserve.hash}`);
}
