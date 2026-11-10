import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import { KeyPair } from "@near-js/crypto";
import { GET, POST } from "../src/app/api/demo/route";
import { call, milliNear, PendingTransactionError, rpc, transact, TransactionFailedError, type DemoAccounts } from "../src/lib/demo-near";
import { evidenceIsCovered, type DemoState, type Evidence, type Step, type TransactionReference } from "../src/lib/demo-state";
import { recordPending } from "../src/lib/pending-transaction";

const url = "http://127.0.0.1:3000/api/demo";
const cli = promisify(execFile);
const headers = { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000", "content-type": "application/json" };

async function snapshot() {
  const response = await GET(new Request(url));
  assert.equal(response.status, 200);
  return await response.json() as DemoState;
}

async function until(predicate: (state: DemoState) => boolean, seconds: number) {
  const end = Date.now() + seconds * 1000;
  do {
    const state = await snapshot();
    if (predicate(state)) return state;
    await delay(800);
  } while (Date.now() < end);
  throw new Error("The expected on-chain state did not arrive in time.");
}

async function action(step: Step | "reconcile", policyId: number | null, fields: object = {}, expectedStatus = 200) {
  const response = await POST(new Request(url, {
    method: "POST", headers, body: JSON.stringify({ step, expectedPolicyId: policyId, ...fields }),
  }));
  const body = await response.json();
  assert.equal(response.status, expectedStatus, `${step}: ${JSON.stringify(body)}`);
  return body;
}

async function withLostResponse<T>(run: () => Promise<T>) {
  const realFetch = globalThis.fetch;
  let dropLookup = false;
  globalThis.fetch = Object.assign(async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = typeof init?.body === "string" ? JSON.parse(init.body).method : undefined;
    if (dropLookup && method === "tx") throw new Error("Simulated lost immediate status lookup");
    const response = await realFetch(input, init);
    if (method === "send_tx") {
      const result = await response.json();
      assert.equal(result.result?.final_execution_status, "FINAL");
      dropLookup = true;
      throw new Error("Simulated lost response after testnet execution");
    }
    return response;
  }, realFetch);
  try {
    return await run();
  } finally {
    globalThis.fetch = realFetch;
  }
}

async function main() {
  assert.equal(process.env.AGSURANCE_RUN_LIVE_TESTS, "1", "Use a dedicated fresh testnet setup.");
  const accounts = JSON.parse(process.env.AGSURANCE_DEMO_ACCOUNTS ?? "null") as DemoAccounts | null;
  assert(accounts?.pool && accounts.recovery && accounts.supplier);
  assert.equal(accounts.owner.id, accounts.policyOwner, "Use the generated testnet owner.");
  const empty = await snapshot();
  const resumed = process.env.AGSURANCE_RESUME_LIVE_TESTS === "1";
  if (resumed) assert.equal(empty.policy?.phase, "Closed");
  else assert.equal(empty.policy, null);
  assert.equal(empty.reserveStatus?.locked, "0");
  assert.equal(empty.coverage?.window_seconds, 30, "Set AGSURANCE_TEST_WINDOW_SECONDS=30 at setup.");
  const mandate = { supplier: accounts.supplier, limit: (BigInt(50) * milliNear).toString() };
  const allocation = (BigInt(400) * milliNear).toString();
  const owner = await rpc<{ amount: string }>("query", { request_type: "view_account", finality: "final", account_id: accounts.owner.id });
  assert(BigInt(owner.amount) >= BigInt(resumed ? 550 : 950) * milliNear, "Top up the testnet owner before running the checks.");

  let first = empty.policy?.id;
  if (first === undefined) {
    const bought = await action("buy", null, { mandate });
    first = bought.state.policy.id as number;
    assert.equal(bought.state.status.coverage, "active");
    assert.equal(bought.state.reserveStatus.locked, allocation);
    await action("close", first, {}, 409);
    console.log(`Waiting for policy ${first}'s filing window to close.`);
    await until(state => state.status?.actions.close === "available", 180);
    const closed = await action("close", first);
    assert.equal(closed.state.policy.phase, "Closed");
    assert.equal(closed.state.reserveStatus.locked, "0");
    console.log(`Expired policy released collateral: ${closed.activity.hash}`);
  }

  const next = await action("buy", first, { mandate });
  const second = next.state.policy.id as number;
  const key = KeyPair.fromRandom("ed25519");
  const connected = await action("connect", second, { publicKey: key.getPublicKey().toString() });
  const stale = await action("revoke", first, {}, 409);
  assert.equal(stale.code, "stale_policy");
  assert((await snapshot()).agent?.connected);
  console.log("A stale revoke left the new agent grant connected.");

  const payment: { reference?: TransactionReference } = {};
  const agentFile = join(".agsurance-demo", `${accounts.vault}-agent-pending.json`);
  const amount = (BigInt(10) * milliNear).toString();
  await assert.rejects(withLostResponse(() => transact(
    { id: connected.state.agent.account_id, key: key.toString() }, accounts.vault,
    [call("pay_supplier", { policy_id: second, recipient: accounts.supplier, amount })],
    async reference => {
      payment.reference = reference;
      await recordPending(agentFile, { ...reference, command: "pay" });
    },
  )), PendingTransactionError);
  assert(payment.reference);
  const script = join(import.meta.dirname, "agent.ts");
  const confirmed = JSON.parse((await cli(process.execPath, [script, "reconcile", accounts.vault])).stdout);
  assert.equal(confirmed.transactionHash, payment.reference.transactionHash);
  assert.equal((await snapshot()).operatingBalance, (BigInt(next.state.operatingBalance) - BigInt(amount)).toString());
  console.log(`CLI recovered the original supplier payment: ${payment.reference.transactionHash}`);

  const boundary = next.state.policy.windows[0] * 1000 + 30_000;
  await delay(Math.max(0, boundary - Date.now() - 1_750));
  const loss = await transact(accounts.runner, accounts.wallet, [call("simulate_loss", { policy_id: second })]);
  await until(state => state.status?.coverage === "lapsed", 20);
  await action("pause", second);
  await action("recover", second);
  const filed = await action("recovery-claim", second);
  assert.equal(filed.state.policy.phase, "InReview");
  const evidenceResponse = await GET(new Request(`${url}?loss_tx=${loss.hash}`));
  assert.equal(evidenceResponse.status, 200);
  const evidence = await evidenceResponse.json() as Evidence;
  const recordedAt = filed.state.policy.incident.recorded_at as number;
  assert(evidence.block_timestamp_ms !== undefined);
  const beforeBoundary = { ...evidence, block_timestamp_ms: boundary - 1 };
  const atBoundary = { ...evidence, block_timestamp_ms: boundary };
  assert(evidenceIsCovered(filed.state, beforeBoundary));
  assert(!evidenceIsCovered(filed.state, atBoundary));
  const covered = evidenceIsCovered(filed.state, evidence);
  console.log(JSON.stringify({ loss: loss.hash, receiptTime: evidence.block_timestamp_ms, callbackTime: recordedAt * 1000, boundary, covered }));

  const open = await until(state => (state.chain_time ?? 0) >= (state.status?.filingDeadline ?? Infinity), 45);
  assert.equal(open.status?.actions.close, "policy_state");
  assert.equal(open.reserveStatus?.locked, allocation);
  await action("close", second, {}, 409);
  await assert.rejects(transact(accounts.runner, accounts.vault, [call("close_policy", { policy_id: second })]), TransactionFailedError);
  await action("review1", second, { lossTx: loss.hash });
  const reviewed = await action("review2", second, { lossTx: loss.hash });
  assert.equal(reviewed.state.policy.phase, covered ? "Approved" : "Rejected");
  if (!covered) {
    const rejected = await action("close", second);
    assert.equal(rejected.state.reserveStatus.locked, "0");
    console.log("An uncovered receipt was rejected and its reserve released after the filing deadline.");
    return;
  }

  const pending = await withLostResponse(() => action("pay", second, {}, 409));
  assert.equal(pending.code, "pending_confirmation");
  const paid = await action("reconcile", second);
  assert.equal(paid.activity.hash, pending.transactionHash);
  assert.equal(paid.state.policy.phase, "Paid");
  assert.equal(paid.state.payoutProof.hash, pending.transactionHash);
  assert(paid.state.payoutProof.receipt);
  assert.equal(paid.state.reserveStatus.locked, "0");
  console.log(`Recovered the original payout receipt: ${paid.activity.hash}/receipts`);
}

await main();
