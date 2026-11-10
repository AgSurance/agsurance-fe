import { readFile, writeFile } from "node:fs/promises";
import { KeyPair } from "@near-js/crypto";
import { call, transact, view } from "../src/lib/demo-near";
import type { Dashboard } from "../src/lib/demo-state";

const [command, target, keyFile] = process.argv.slice(2);
const explorer = "https://testnet.nearblocks.io/txns/";

async function main() {
  if (command === "init" && target && !keyFile) {
    const key = KeyPair.fromRandom("ed25519");
    await writeFile(target, key.toString(), { mode: 0o600, flag: "wx" });
    console.log(key.getPublicKey().toString());
    return;
  }

  if (!target?.endsWith(".testnet") || !["status", "submit-claim"].includes(command)) {
    throw new Error("Usage: agent.ts init KEY_FILE | status VAULT | submit-claim VAULT KEY_FILE");
  }
  const dashboard = await view<Dashboard>(target, "dashboard");
  if (command === "status") {
    console.log(JSON.stringify({
      network: "testnet", vault: target, policy: dashboard.policy, agent: dashboard.agent,
      recoveryAccount: dashboard.beneficiary,
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
