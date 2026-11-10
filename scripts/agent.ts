import { readFile, writeFile } from "node:fs/promises";
import { KeyPair } from "@near-js/crypto";
import { call, transact, view } from "../src/lib/demo-near";
import { parseNear, type Dashboard } from "../src/lib/demo-state";

const [command, target, keyFile, recipient, amount] = process.argv.slice(2);
const explorer = "https://testnet.nearblocks.io/txns/";

async function main() {
  if (command === "init" && target && !keyFile) {
    const key = KeyPair.fromRandom("ed25519");
    await writeFile(target, key.toString(), { mode: 0o600, flag: "wx" });
    console.log(key.getPublicKey().toString());
    return;
  }

  if (!target?.endsWith(".testnet") || !["status", "submit-claim", "pay", "renew"].includes(command)) {
    throw new Error("Usage: agent.ts init KEY_FILE | status VAULT | submit-claim VAULT KEY_FILE | pay VAULT KEY_FILE RECIPIENT AMOUNT_NEAR | renew VAULT KEY_FILE");
  }
  const dashboard = await view<Dashboard>(target, "dashboard");
  if (command === "status") {
    console.log(JSON.stringify({
      network: "testnet", vault: target, policy: dashboard.policy, agent: dashboard.agent,
      recoveryAccount: dashboard.beneficiary, coverage: dashboard.coverage,
    }, null, 2));
    return;
  }

  const policy = dashboard.policy;
  const agent = dashboard.agent;
  if (!policy || policy.phase !== "Active") throw new Error("The vault does not have an active policy.");
  if (!agent?.connected) throw new Error("The policy owner has not authorized a connected agent.");
  if (!keyFile) throw new Error("Pass the private key file created by init.");
  const key = (await readFile(keyFile, "utf8")).trim();
  const publicKey = KeyPair.fromString(key as `ed25519:${string}`).getPublicKey().toString();
  if (publicKey !== agent.public_key) throw new Error("This key does not match the authorized agent.");
  if (command === "renew") {
    const coverage = dashboard.coverage;
    if (!coverage) throw new Error("This vault does not support renewal.");
    if (coverage.renewal_pending || coverage.payable_window == null) {
      console.log(JSON.stringify({ status: coverage.renewal_pending ? "Premium pending" : "No premium due" }));
      return;
    }
    const outcome = await transact({ id: agent.account_id, key }, target, [call("pay_premium", { policy_id: policy.id })]);
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
    const outcome = await transact({ id: agent.account_id, key }, target, [
      call("pay_supplier", { policy_id: policy.id, recipient, amount: yocto }),
    ]);
    console.log(JSON.stringify({
      status: "Paid supplier", recipient, amountNear: amount,
      transactionHash: outcome.hash, explorerUrl: `${explorer}${outcome.hash}/receipts`,
    }, null, 2));
    return;
  }
  const outcome = await transact({ id: agent.account_id, key }, target, [call("submit_claim", { policy_id: policy.id })]);
  console.log(JSON.stringify({
    claimId: `${target}/${policy.id}`, status: "InReview",
    transactionHash: outcome.hash, explorerUrl: `${explorer}${outcome.hash}`,
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Agent command failed.");
  process.exitCode = 1;
});
