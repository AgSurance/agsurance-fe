import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { KeyPair } from "@near-js/crypto";
import { call, PendingTransactionError, readDashboard, reconcileTransaction, transact, TransactionFailedError, type SignedReference } from "../src/lib/demo-near";
import { parseNear, projectStatus, type TransactionReference } from "../src/lib/demo-state";
import { clearPending, readPending, recordPending } from "../src/lib/pending-transaction";

const [command, target, keyFile, recipient, amount] = process.argv.slice(2);
const explorer = "https://testnet.nearblocks.io/txns/";

async function main() {
  if (command === "init" && target && !keyFile) {
    const key = KeyPair.fromRandom("ed25519");
    await writeFile(target, key.toString(), { mode: 0o600, flag: "wx" });
    console.log(key.getPublicKey().toString());
    return;
  }

  if (!target || !/^[a-z0-9_-]+(?:\.[a-z0-9_-]+)*\.testnet$/.test(target) ||
      !["status", "submit-claim", "pay", "renew", "reconcile"].includes(command)) {
    throw new Error("Usage: agent.ts init KEY_FILE | status VAULT | submit-claim VAULT KEY_FILE | pay VAULT KEY_FILE RECIPIENT AMOUNT_NEAR | renew VAULT KEY_FILE | reconcile VAULT");
  }
  const file = join(".agsurance-demo", `${target}-agent-pending.json`);
  const pending = await readPending<SignedReference & { command: string }>(file);
  if (command === "reconcile") {
    if (!pending) {
      console.log(JSON.stringify({ status: "No pending transaction" }));
      return;
    }
    try {
      await reconcileTransaction(pending);
      await clearPending(file, pending);
      console.log(JSON.stringify({ status: "Confirmed", command: pending.command, transactionHash: pending.transactionHash,
        explorerUrl: `${explorer}${pending.transactionHash}/receipts` }));
    } catch (error) {
      if (error instanceof TransactionFailedError) await clearPending(file, pending);
      throw error;
    }
    return;
  }
  if (pending && command !== "status") throw new PendingTransactionError(pending);
  const dashboard = await readDashboard(target);
  const status = projectStatus(dashboard, pending && { transactionHash: pending.transactionHash, signerId: pending.signerId });
  if (command === "status") {
    console.log(JSON.stringify({
      network: "testnet", vault: target, policy: dashboard.policy, agent: dashboard.agent,
      recoveryAccount: dashboard.beneficiary, coverage: dashboard.coverage, status,
    }, null, 2));
    return;
  }

  const policy = dashboard.policy;
  const agent = dashboard.agent;
  if (!policy || policy.phase !== "Active") throw new Error("The vault does not have an active policy.");
  if (!agent?.connected) throw new Error("The policy owner has not authorized a connected agent.");
  const agentAccount = agent.account_id;
  if (!keyFile) throw new Error("Pass the private key file created by init.");
  const key = (await readFile(keyFile, "utf8")).trim();
  const publicKey = KeyPair.fromString(key as `ed25519:${string}`).getPublicKey().toString();
  if (publicKey !== agent.public_key) throw new Error("This key does not match the authorized agent.");
  async function send(method: string, args: object) {
    let pending: TransactionReference | undefined;
    try {
      const result = await transact({ id: agentAccount, key }, target, [call(method, args)], async reference => {
        await recordPending(file, { ...reference, command });
        pending = reference;
      });
      if (pending) await clearPending(file, pending);
      return result;
    } catch (error) {
      if (pending && error instanceof TransactionFailedError) await clearPending(file, pending);
      throw error;
    }
  }
  if (command === "renew") {
    const coverage = dashboard.coverage;
    if (!coverage) throw new Error("This vault does not support renewal.");
    if (status.actions.renew === "pending" || status.actions.renew === "no_premium_due") {
      console.log(JSON.stringify({ status: coverage.renewal_pending ? "Premium pending" : "No premium due", renewal: status.renewal }));
      return;
    }
    if (status.actions.renew !== "available" || coverage.payable_window == null) {
      throw new Error(`Renewal unavailable: ${status.actions.renew}`);
    }
    if (status.renewal?.blocker === "insufficient_balance") {
      throw new Error(`Top up the wallet before paying ${status.renewal.amount} yoctoNEAR for period ${status.renewal.period}.`);
    }
    const outcome = await send("pay_premium", { policy_id: policy.id });
    console.log(JSON.stringify({
      status: "Premium confirmed", window: coverage.payable_window + 1,
      transactionHash: outcome.hash, explorerUrl: `${explorer}${outcome.hash}/receipts`,
    }, null, 2));
    return;
  }
  if (command === "pay") {
    const yocto = amount && parseNear(amount);
    if (!policy.mandate) throw new Error("This vault does not support supplier payments.");
    if (!recipient || !yocto || yocto === "0") throw new Error("Pass a recipient and a positive NEAR amount.");
    if (status.actions["pay-supplier"] !== "available") throw new Error(`Supplier payment unavailable: ${status.actions["pay-supplier"]}`);
    const outcome = await send("pay_supplier", { policy_id: policy.id, recipient, amount: yocto });
    console.log(JSON.stringify({
      status: "Paid supplier", recipient, amountNear: amount,
      transactionHash: outcome.hash, explorerUrl: `${explorer}${outcome.hash}/receipts`,
    }, null, 2));
    return;
  }
  if (status.actions["agent-claim"] !== "available") throw new Error(`Claim unavailable: ${status.actions["agent-claim"]}`);
  const outcome = await send("submit_claim", { policy_id: policy.id });
  console.log(JSON.stringify({
    claimId: `${target}/${policy.id}`, status: "InReview",
    transactionHash: outcome.hash, explorerUrl: `${explorer}${outcome.hash}`,
  }, null, 2));
}

main().catch((error: unknown) => {
  if (error instanceof PendingTransactionError) {
    console.error(JSON.stringify({ status: "pending_confirmation", transactionHash: error.reference.transactionHash,
      signerId: error.reference.signerId, message: error.message }));
    process.exitCode = 2;
    return;
  }
  console.error(error instanceof Error ? error.message : "Agent command failed.");
  process.exitCode = 1;
});
