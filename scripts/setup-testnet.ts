import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { KeyPair } from "@near-js/crypto";
import { baseEncode } from "@near-js/utils";
import { dirname } from "node:path";
import { parseNear, type Dashboard, type VendorConfirmation } from "../src/lib/demo-state";
import { readReplacement, replacementFile } from "../src/lib/replacement-wallet";
import { actions, call, milliNear, rpc, transact, view, type Actor, type DemoAccounts } from "../src/lib/demo-near";

const pilotValidator = process.env.AGSURANCE_PILOT_VALIDATOR;
const pilotBuffer = parseNear(process.env.AGSURANCE_PILOT_BUFFER_NEAR ?? "0.10");
const pilotCap = parseNear(process.env.AGSURANCE_PILOT_STAKE_CAP_NEAR ?? "0.10");
if (pilotValidator && (!pilotBuffer || pilotBuffer === "0" || !pilotCap || pilotCap === "0")) {
  throw new Error("Set a positive pilot buffer and staking cap.");
}

const saved = process.env.AGSURANCE_DEMO_ACCOUNTS;
const configured = saved ? JSON.parse(saved) as DemoAccounts : undefined;
const replacing = process.argv[3] === "--replacement";
if (replacing && !configured?.pool) throw new Error("Load the retired vault configuration first.");
const previous = replacing ? configured : undefined;
const previousState = previous ? await view<Dashboard>(previous.vault, "dashboard") : undefined;
if (previous && !previousState?.coverage?.retired) throw new Error("Retire the previous wallet first.");
if (previous && !previousState?.wallet_code_hash) throw new Error("Use a current testnet vault and reserve for replacement setup.");
const destination = previous && replacementFile(previous.vault);
const existing = destination ? await readFile(`${destination}.pending`, "utf8").then(
  raw => JSON.parse(raw) as DemoAccounts, error => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return readReplacement(previous!.vault);
    throw error;
  }) : configured;
if (existing && !existing.pool) throw new Error("Use a fresh testnet configuration for the shared reserve.");
const baseId = existing?.owner.id ?? previous?.owner.id ?? `agsurance-${randomBytes(4).toString("hex")}.testnet`;
const suffix = previous ? `-${randomBytes(3).toString("hex")}` : "";
const createActor = (id: string) => ({ id, key: KeyPair.fromRandom("ed25519").toString() });
const owner = existing?.owner ?? previous?.owner ?? createActor(baseId);
const policyOwner = existing?.policyOwner ?? previousState?.owner ?? process.env.AGSURANCE_POLICY_OWNER ?? owner.id;
if (!policyOwner.endsWith(".testnet")) throw new Error("Use a named NEAR testnet wallet as policy owner.");
const runner = existing?.runner ?? previous?.runner ?? createActor(`agent.${baseId}`);
const wallet = createActor(existing?.wallet ?? `wallet${suffix}.${baseId}`);
const pool = createActor(existing?.pool ?? previous?.pool ?? `pool.${baseId}`);
const vault = createActor(existing?.vault ?? `vault${suffix}.${baseId}`);
const beneficiary = existing?.recovery ?? previous?.recovery ?? createActor(`recovery.${baseId}`);
const recoveryAccount = previousState?.beneficiary ?? beneficiary.id;
const confirmation = previous && previousState?.wallet_code_hash && previousState.policy
  ? await view<VendorConfirmation | null>(previous.vault, "vendor_confirmation", { policy_id: previousState.policy.id })
  : null;
const confirmedSupplier = confirmation && confirmation.expires_at > (previousState?.chain_time ?? Math.floor(Date.now() / 1000))
  ? confirmation.new_supplier : undefined;
const supplier = createActor(existing?.supplier ?? confirmedSupplier ?? previous?.supplier ?? `supplier.${baseId}`);
const recipient = createActor(`incident.${baseId}`);
const reviewers = existing?.reviewers ?? previous?.reviewers ?? [1, 2, 3].map(n => createActor(`reviewer${n}.${baseId}`)) as [Actor, Actor, Actor];
const accounts: DemoAccounts = { owner, policyOwner, supplier: supplier.id, recovery: beneficiary, runner, reviewers, wallet: wallet.id, vault: vault.id, pool: pool.id };
const wasm = process.argv[2];
if (!wasm) throw new Error("Pass the smart-contract WASM output directory");
const [walletCode, vaultCode, poolCode] = await Promise.all([
  readFile(`${wasm}/agent_wallet.wasm`), readFile(`${wasm}/coverage_vault.wasm`), readFile(`${wasm}/reserve_pool.wasm`),
]);
// Testnet storage costs 0.01 NEAR per KiB approximately. Keep room for contract state.
const contractFunding = (minimum: number, code: Uint8Array) => Math.max(minimum, Math.ceil(code.byteLength / 100) + 350);
const keyFor = (actor: Actor) => KeyPair.fromString(actor.key as `ed25519:${string}`).getPublicKey();
if (!existing && !destination) {
  await writeFile(".env.local", `AGSURANCE_DEMO_ACCOUNTS='${JSON.stringify(accounts)}'\n`, { mode: 0o600, flag: "wx" });
}

// Persist the selected account IDs before sending any transaction. The final file
// is published only after all deployments and reserve registration succeed.
const pendingDestination = destination ? `${destination}.pending` : undefined;
if (pendingDestination && !existing) {
  await mkdir(dirname(pendingDestination), { recursive: true, mode: 0o700 });
  await writeFile(pendingDestination, JSON.stringify(accounts), { mode: 0o600, flag: "wx" });
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
if (previous && !(await accountExists(supplier.id))) {
  throw new Error("The supplier named in the replacement configuration must exist on testnet.");
}
if (!previous) await createAccount(supplier, 30);
for (const reviewer of reviewers) await createAccount(reviewer, 100);
await createAccount(wallet, contractFunding(2500, walletCode), [actions.deployContract(walletCode), call("new", { vault: vault.id, runner: runner.id, recipient: recipient.id })]);
await createAccount(pool, contractFunding(2000, poolCode), [actions.deployContract(poolCode), call("new", { operator: owner.id })]);
await createAccount(vault, contractFunding(3200, vaultCode), [actions.deployContract(vaultCode), call("new", {
  owner: policyOwner, runner: runner.id, wallet: wallet.id, beneficiary: recoveryAccount, reviewers: reviewers.map(r => r.id),
  reserve_pool: pool.id,
  capital_pilot: previous ? !!await view(pool.id, "capital_status") : !!pilotValidator,
  wallet_code_hash: baseEncode(createHash("sha256").update(walletCode).digest()),
  test_review_seconds: process.env.AGSURANCE_TEST_REVIEW_SECONDS ? Number(process.env.AGSURANCE_TEST_REVIEW_SECONDS) : null,
  test_window_seconds: process.env.AGSURANCE_TEST_WINDOW_SECONDS ? Number(process.env.AGSURANCE_TEST_WINDOW_SECONDS) : null,
  test_claim_seconds: process.env.AGSURANCE_TEST_CLAIM_SECONDS ? Number(process.env.AGSURANCE_TEST_CLAIM_SECONDS) : null,
})]);
if (!(await view<string | null>(pool.id, "vault_beneficiary", { vault: vault.id }))) {
  await transact(owner, pool.id, [call("register_vault", { vault: vault.id, beneficiary: recoveryAccount })]);
}
const { assets } = await view<{ assets: string }>(pool.id, "reserve_status");
if (destination && pendingDestination) {
  if (!await readReplacement(previous!.vault)) await rename(pendingDestination, destination);
} else if (pilotValidator) {
  const pilot = await view<{ validator: string; buffer: string; delegation_cap: string } | null>(pool.id, "capital_status");
  if (pilot && (pilot.validator !== pilotValidator || pilot.buffer !== pilotBuffer || pilot.delegation_cap !== pilotCap)) {
    throw new Error("This pool already has different pilot terms.");
  }
  if (!pilot) {
    const configured = await transact(owner, pool.id, [call("configure_capital_pilot", {
      validator: pilotValidator, buffer: pilotBuffer, delegation_cap: pilotCap, capital_bps: 7_000, cashback_bps: 2_000,
    })]);
    console.log(`Capital pilot configured: ${configured.hash}`);
  }
} else if (assets === "0") {
  const reserve = await transact(owner, pool.id, [call("fund_reserve", {}, BigInt(1000) * milliNear)]);
  console.log(`Demo reserve funded: ${reserve.hash}`);
}
