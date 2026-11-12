import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { cliPayoutHash, cliReceipts, historicalPayoutHash } from "../src/lib/demo-links";

const rpcUrl = process.env.AGSURANCE_TESTNET_RPC ?? "https://archival-rpc.testnet.fastnear.com";
const yocto = (milliNear: number) => (BigInt(milliNear) * BigInt("1000000000000000000000")).toString();
const policyId = 1;
const simulatedLoss = yocto(300);
const deductible = yocto(50);

const cli = {
  vault: "vault.agsurance-7910a4d8.testnet",
  wallet: "wallet.agsurance-7910a4d8.testnet",
  pool: "pool.agsurance-7910a4d8.testnet",
  owner: "agsurance-7910a4d8.testnet",
  runner: "agent.agsurance-7910a4d8.testnet",
  agent: "agent-1.vault.agsurance-7910a4d8.testnet",
  supplier: "supplier.agsurance-7910a4d8.testnet",
  incident: "incident.agsurance-7910a4d8.testnet",
  beneficiary: "recovery.agsurance-7910a4d8.testnet",
  reviewers: ["reviewer1.agsurance-7910a4d8.testnet", "reviewer2.agsurance-7910a4d8.testnet"],
  hashes: {
    ...cliReceipts,
    checkout: "9z5JCov2sVrZYE3gN9nyE4vBmtHe9KZYiwAZVGzH62pw",
    connect: "32tQ1gya41MBpNtBWKn6HvPErxp6Acdg9aLMARmauteb",
    loss: "4xLhrcrh6uBeQzqF3YdYiamGR4ysBw2GcQRxVwFpuxa5",
    votes: ["4QQF7JEdqGjDnyySY3co9RKZLMD3bVA8SwhskPz8RD3X", "8m4Yg68qLei14rVzwwhYEhJ8aSLFyov2E3A7u3Wdp8NH"],
    payout: cliPayoutHash,
  },
} as const;

const historical = {
  vault: "v-1cba0c6bad2c3e0cea5b.f.agmaker-dd6ef8.testnet",
  wallet: "w-1cba0c6bad2c3e0cea5b.f.agmaker-dd6ef8.testnet",
  pool: "r.agpool-9c4458.testnet",
  owner: "agbuyone-1aff13.testnet",
  runner: "agpool-9c4458.testnet",
  agent: "agent-1.v-1cba0c6bad2c3e0cea5b.f.agmaker-dd6ef8.testnet",
  supplier: "supplier.agpool-9c4458.testnet",
  incident: "incident.agpool-9c4458.testnet",
  beneficiary: "agbuyone-1aff13.testnet",
  reviewers: ["reviewer1.agpool-9c4458.testnet", "reviewer2.agpool-9c4458.testnet"],
  hashes: {
    deposit: "81QPfbkG2uhDAKc5HL4NhUCqMJijAd1wkHqdfoGQQ49U",
    checkout: "8fTSvqtdGgnu8oSRwoVD9VvESmmonPuQ8PAqz64ZHEco",
    loss: "BymqcFtbnvv1By82NaRvmUegQsc9p5DdZDdtB4z8jDAJ",
    increase: "CL3ko61db2p4Mw2tZaLEaj9hPWLaXZpW3tipt7CyrkNV",
    claim: "J4nvLf47vmy5rfwf2aB1nU2TYXeQ68cK5d5qEGyuqeD6",
    votes: ["AixCayE4YVQJmZHGyg66rgNLEf65574qabX2bYZE8HrK", "8X9joNTVEjpzZs5Vnc3XNb4g7umoEKPBFmu3gPeQGs5t"],
    payout: historicalPayoutHash,
  },
} as const;

type Run = typeof cli | typeof historical;
type Call = { method_name: string; args: string; deposit: string };
type Action = string | {
  FunctionCall?: Call;
  Transfer?: { deposit: string };
  AddKey?: {
    public_key: string;
    access_key: { permission: { FunctionCall?: { receiver_id: string; method_names: string[] } } | string };
  };
};
type Status = { SuccessValue?: string; SuccessReceiptId?: string; Failure?: unknown };
type Outcome = { id: string; block_hash: string; outcome: { status: Status } };
type Receipt = {
  receipt_id: string;
  predecessor_id: string;
  receiver_id: string;
  receipt: { Action?: { actions: Action[] }; ActionV2?: { actions: Action[] } };
};
type Transaction = {
  final_execution_status: string;
  status: Status;
  transaction: { hash: string; signer_id: string; receiver_id: string; actions: Action[] };
  transaction_outcome: Outcome;
  receipts: Receipt[];
  receipts_outcome: Outcome[];
};
type Evidence = {
  transaction_hash: string;
  receipt_id: string;
  block_height: number;
  recipient: string;
  amount: string;
  block_timestamp_ms: number;
};
type PolicyState = {
  limit: string;
  reserved: string;
  reserve_pool: string;
  beneficiary: string;
  deductible: string;
  coverage: { active: boolean };
  policy: {
    id: number;
    mandate: { supplier: string; limit: string };
    limit_changes?: { limit: string; effective_height: number }[];
  };
};

async function rpc<T>(method: "EXPERIMENTAL_tx_status" | "block" | "query", params: object): Promise<T> {
  const rateLimitDelays = [1_000, 5_000, 15_000, 30_000];
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: "agsurance-receipts", method, params }),
        signal: AbortSignal.timeout(12_000),
      });
      if (response.status === 429 && attempt < rateLimitDelays.length) {
        const retryAfter = response.headers.get("retry-after") ?? "";
        const requestedDelay = /^\d+$/.test(retryAfter)
          ? Number(retryAfter) * 1_000
          : Date.parse(retryAfter) - Date.now();
        const wait = Math.min(60_000, Math.max(rateLimitDelays[attempt], requestedDelay || 0));
        console.error(`NEAR RPC rate limit. Retrying in ${Math.ceil(wait / 1_000)}s.`);
        await delay(wait);
        continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json() as { result?: T; error?: { message?: string; cause?: { name?: string } } };
      if (body.result === undefined) throw new Error(body.error?.cause?.name ?? body.error?.message ?? "Missing result");
      return body.result;
    } catch (error) {
      if (attempt > 0) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`NEAR RPC ${method}: ${reason}`);
      }
      await delay(700);
    }
  }
}

async function transaction(hash: string, signer: string, receiver: string) {
  const tx = await rpc<Transaction>("EXPERIMENTAL_tx_status", {
    tx_hash: hash, sender_account_id: signer, wait_until: "FINAL",
  });
  assert.equal(tx.final_execution_status, "FINAL", "Transaction must be final");
  assert.equal(tx.transaction.hash, hash, "Transaction hash");
  assert.equal(tx.transaction.signer_id, signer, "Transaction signer");
  assert.equal(tx.transaction.receiver_id, receiver, "Transaction receiver");
  assert(Array.isArray(tx.receipts) && Array.isArray(tx.receipts_outcome), "RPC must return receipts and outcomes");
  return tx;
}

const actions = (receipt: Receipt) => (receipt.receipt.Action ?? receipt.receipt.ActionV2)?.actions ?? [];
const decodeArgs = (call: Call) => JSON.parse(Buffer.from(call.args, "base64").toString()) as Record<string, unknown>;

function rootCall(tx: Transaction, method: string, args: Record<string, unknown>) {
  assert.equal(tx.transaction.actions.length, 1, "Expected one transaction action");
  const action = tx.transaction.actions[0];
  const call = typeof action === "object" ? action.FunctionCall : undefined;
  assert(call && call.method_name === method, `Expected ${method} transaction`);
  const actual = decodeArgs(call);
  for (const [key, value] of Object.entries(args)) assert.deepEqual(actual[key], value, `${method} argument ${key}`);
  return { call, actual };
}

function outcome(tx: Transaction, receipt: Receipt) {
  const entry = tx.receipts_outcome.find(item => item.id === receipt.receipt_id);
  assert(entry, `Missing outcome for receipt ${receipt.receipt_id}`);
  return entry;
}

function receiptCall(tx: Transaction, account: string, method: string, args?: Record<string, unknown>) {
  const matches = tx.receipts.filter(receipt => receipt.receiver_id === account).flatMap(receipt =>
    actions(receipt).flatMap(action => {
      const call = typeof action === "object" ? action.FunctionCall : undefined;
      return call?.method_name === method ? [{ receipt, call }] : [];
    }));
  assert.equal(matches.length, 1, `Expected one ${method} receipt on ${account}`);
  const [{ receipt, call }] = matches;
  if (args) assert.deepEqual(decodeArgs(call), args, `${method} arguments`);
  return outcome(tx, receipt);
}

function returned(status: Status, expected: boolean | number | string) {
  assert.equal(status.SuccessValue, Buffer.from(JSON.stringify(expected)).toString("base64"), "Unexpected contract result");
}

function transfersFrom(tx: Transaction, sender: string) {
  return tx.receipts.flatMap(receipt => {
    if (receipt.predecessor_id !== sender) return [];
    const amounts = actions(receipt).flatMap(action =>
      typeof action === "object" && action.Transfer ? [action.Transfer.deposit] : []);
    if (amounts.length === 0) return [];
    const execution = outcome(tx, receipt);
    return execution.outcome.status.SuccessValue === undefined ? [] : amounts.map(amount => ({ receipt, execution, amount }));
  });
}

function transfer(tx: Transaction, sender: string, recipient: string, amount: string) {
  const transfers = transfersFrom(tx, sender);
  assert.equal(transfers.length, 1, `Expected one successful transfer from ${sender}`);
  const [entry] = transfers;
  assert.equal(entry.receipt.receiver_id, recipient, "Transfer recipient");
  assert.equal(entry.amount, amount, "Transfer amount in yoctoNEAR");
  return entry;
}

async function block(blockHash: string) {
  const { header } = await rpc<{ header: { hash: string; height: number; timestamp_nanosec: string } }>("block", { block_id: blockHash });
  assert.equal(header.hash, blockHash, "Receipt execution block hash");
  return header;
}

async function policyAt(run: Run, blockHash: string, expectedLimit: string) {
  const result = await rpc<{ result: number[]; block_hash: string }>("query", {
    request_type: "call_function", account_id: run.vault, method_name: "dashboard", args_base64: "e30=", block_id: blockHash,
  });
  assert.equal(result.block_hash, blockHash, "Policy state block hash");
  const state = JSON.parse(Buffer.from(result.result).toString()) as PolicyState;
  assert.equal(state.policy.id, policyId, "Policy ID");
  assert.equal(state.coverage.active, true, "Coverage was active");
  assert.equal(state.limit, expectedLimit, "Policy payout limit");
  assert.equal(state.reserved, expectedLimit, "Amount reserved for the policy");
  assert.equal(state.reserve_pool, run.pool, "Registered reserve");
  assert.equal(state.beneficiary, run.beneficiary, "Registered recovery account");
  assert.equal(state.deductible, deductible, "Policy deductible");
  assert.deepEqual(state.policy.mandate, { supplier: run.supplier, limit: yocto(50) }, "Spending mandate");
  return state;
}

async function checkCheckout(run: Run, coverageLimit?: string) {
  const tx = await transaction(run.hashes.checkout, run.owner, run.vault);
  const args = { supplier: run.supplier, limit: yocto(50), expected_policy_id: 0 };
  rootCall(tx, "buy_policy", coverageLimit ? { ...args, coverage_limit: coverageLimit } : args);
  returned(receiptCall(tx, run.pool, "reserve_policy").outcome.status, true);
  returned(tx.status, true);
}

async function checkLoss(run: Run, limit: string): Promise<Evidence> {
  const tx = await transaction(run.hashes.loss, run.runner, run.wallet);
  rootCall(tx, "simulate_loss", { policy_id: policyId });
  returned(tx.status, true);
  const loss = transfer(tx, run.wallet, run.incident, simulatedLoss);
  const header = await block(loss.execution.block_hash);
  await policyAt(run, header.hash, limit);
  return {
    transaction_hash: run.hashes.loss, receipt_id: loss.receipt.receipt_id, block_height: header.height,
    recipient: run.incident, amount: loss.amount, block_timestamp_ms: Number(BigInt(header.timestamp_nanosec) / BigInt(1_000_000)),
  };
}

async function checkFiling(run: Run, earliestBlock: number) {
  const tx = await transaction(run.hashes.claim, run.agent, run.vault);
  rootCall(tx, "submit_claim", { policy_id: policyId });
  returned(tx.status, true);
  const header = await block(receiptCall(tx, run.vault, "submit_claim").block_hash);
  assert(header.height >= earliestBlock, `Claim filed before block ${earliestBlock}`);
}

async function checkVotes(run: Run, evidence: Evidence) {
  for (const [index, hash] of run.hashes.votes.entries()) {
    const tx = await transaction(hash, run.reviewers[index], run.vault);
    rootCall(tx, "approve_claim", { policy_id: policyId, evidence });
    returned(tx.status, index + 1);
  }
}

async function checkPayout(run: Run, loss: Evidence, limit: string, payout: string) {
  const netLoss = BigInt(loss.amount) - BigInt(deductible);
  assert.equal((netLoss < BigInt(limit) ? netLoss : BigInt(limit)).toString(), payout, "Payout calculation");
  const tx = await transaction(run.hashes.payout, run.runner, run.vault);
  rootCall(tx, "pay_claim", { policy_id: policyId });
  receiptCall(tx, run.pool, "settle_claim", { policy_id: policyId, amount: payout });
  const settlement = receiptCall(tx, run.pool, "finish_transfer", { vault: run.vault, policy_id: policyId });
  returned(settlement.outcome.status, "Paid");
  returned(tx.status, true);
  transfer(tx, run.pool, run.beneficiary, payout);
}

async function step<T>(label: string, check: () => Promise<T>): Promise<T> {
  try {
    const result = await check();
    console.log(`PASS  ${label}`);
    return result;
  } catch (error) {
    throw new Error(`${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function verify() {
  console.log("0.25 NEAR CLI replay");
  await step("Checkout activated the policy and booked reserve capacity", () => checkCheckout(cli));
  await step("Agent received a restricted key for payments and claims", async () => {
    const tx = await transaction(cli.hashes.connect, cli.owner, cli.vault);
    const { actual } = rootCall(tx, "connect_agent", { policy_id: policyId });
    returned(tx.status, true);
    const grants = tx.receipts.filter(receipt => receipt.receiver_id === cli.agent).flatMap(receipt =>
      actions(receipt).flatMap(action => typeof action === "object" && action.AddKey
        ? [{ key: action.AddKey, execution: outcome(tx, receipt) }] : []));
    assert.equal(grants.length, 1, "Expected one agent key grant");
    const [{ key, execution }] = grants;
    assert.notEqual(execution.outcome.status.SuccessValue, undefined, "Agent key grant failed");
    assert.equal(key.public_key, actual.public_key, "Granted key");
    const permission = key.access_key.permission;
    assert(typeof permission === "object" && permission.FunctionCall, "Expected a function-call key");
    assert.equal(permission.FunctionCall.receiver_id, cli.vault, "Key restricted to the vault");
    assert.deepEqual([...permission.FunctionCall.method_names].sort(),
      ["pay_premium", "pay_supplier", "submit_claim", "submit_evidence_claim"]);
  });
  await step("Unapproved 0.01 NEAR payment failed at the wallet and moved no funds", async () => {
    const tx = await transaction(cli.hashes.declined, cli.agent, cli.vault);
    rootCall(tx, "pay_supplier", { policy_id: policyId, recipient: cli.beneficiary, amount: yocto(10) });
    assert.notEqual(tx.status.Failure, undefined, "Expected the transaction to fail");
    assert.notEqual(receiptCall(tx, cli.wallet, "pay_supplier").outcome.status.Failure, undefined, "Expected the wallet to reject the payment");
    assert.equal(transfersFrom(tx, cli.wallet).length, 0, "Rejected payment moved funds");
  });
  await step("Approved supplier received 0.05 NEAR from the wallet", async () => {
    const tx = await transaction(cli.hashes.payment, cli.agent, cli.vault);
    rootCall(tx, "pay_supplier", { policy_id: policyId, recipient: cli.supplier, amount: yocto(50) });
    returned(tx.status, true);
    transfer(tx, cli.wallet, cli.supplier, yocto(50));
  });
  const cliLoss = await step("Separate 0.30 NEAR simulated loss executed during active coverage", () => checkLoss(cli, yocto(400)));
  await step("Agent filed the claim after the loss", () => checkFiling(cli, cliLoss.block_height + 1));
  await step("Two reviewers approved the same final loss receipt", () => checkVotes(cli, cliLoss));
  await step("Reserve paid 0.25 NEAR to the registered recovery account",
    () => checkPayout(cli, cliLoss, yocto(400), yocto(250)));

  console.log("\n0.18 NEAR historical payout");
  const oldLimit = yocto(180);
  const newLimit = yocto(420);
  await step("Capital provider deposited 0.80 NEAR into the reserve", async () => {
    const tx = await transaction(historical.hashes.deposit, "agcapital-f494de.testnet", historical.pool);
    assert.equal(rootCall(tx, "fund_capital_pilot", {}).call.deposit, yocto(800), "Capital deposit");
    assert.notEqual(tx.status.SuccessValue, undefined, "Capital deposit failed");
  });
  await step("Checkout activated a policy with a 0.18 NEAR limit", () => checkCheckout(historical, oldLimit));
  const oldLoss = await step("0.30 NEAR simulated loss executed at block 277218273 under the 0.18 NEAR limit", async () => {
    const evidence = await checkLoss(historical, oldLimit);
    assert.equal(evidence.block_height, 277_218_273, "Historical loss block");
    return evidence;
  });
  const effectiveHeight = await step("Vault confirmed 0.42 NEAR at block 277218292, effective from 277218293", async () => {
    const tx = await transaction(historical.hashes.increase, historical.owner, historical.vault);
    rootCall(tx, "request_limit_increase", { policy_id: policyId, expected_limit: oldLimit, limit: newLimit });
    returned(receiptCall(tx, historical.pool, "increase_policy_limit").outcome.status, true);
    const callback = receiptCall(tx, historical.vault, "finish_limit_increase");
    returned(callback.outcome.status, true);
    returned(tx.status, true);
    const header = await block(callback.block_hash);
    assert.equal(header.height, 277_218_292, "Limit confirmation block");
    const state = await policyAt(historical, header.hash, newLimit);
    const height = header.height + 1;
    assert.deepEqual(state.policy.limit_changes?.at(-1), { limit: newLimit, effective_height: height }, "Recorded effective block");
    return height;
  });
  await step("Agent filed the claim after the higher limit took effect", () => checkFiling(historical, effectiveHeight));
  await step("Two reviewers approved the earlier loss receipt", () => checkVotes(historical, oldLoss));
  await step("Reserve paid 0.18 NEAR to the registered recovery account under the original limit",
    () => checkPayout(historical, oldLoss, oldLimit, oldLimit));

  console.log("\nPASS  Both NEAR testnet runs verified");
}

verify().catch(error => {
  console.error(`FAIL  ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
