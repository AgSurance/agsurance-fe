import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PublicKey } from "@near-js/crypto";
import { call, transact, view, type DemoAccounts } from "../../../lib/demo-near";
import type { Activity, Dashboard, Incident, Step } from "../../../lib/demo-state";

export const runtime = "nodejs";
let busy = false;

function config(): DemoAccounts | null {
  const raw = process.env.AGSURANCE_DEMO_ACCOUNTS;
  return raw ? JSON.parse(raw) as DemoAccounts : null;
}

const proofDirectory = join(process.cwd(), ".agsurance-demo");
const proofFile = (vault: string, policyId: number) => join(proofDirectory, `${vault}-${policyId}.json`);

async function snapshot(accounts: DemoAccounts) {
  const [dashboard, incident] = await Promise.all([
    view<Dashboard>(accounts.vault, "dashboard"), view<Incident | null>(accounts.wallet, "incident"),
  ]);
  let payoutProof: Activity | undefined;
  if (dashboard.policy?.phase === "Paid") {
    try {
      payoutProof = JSON.parse(await readFile(proofFile(accounts.vault, dashboard.policy.id), "utf8")) as Activity;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return {
    ...dashboard, incident, wallet: accounts.wallet, vault: accounts.vault, runner: accounts.runner.id,
    demoOwner: (dashboard.owner ?? accounts.owner.id) === accounts.owner.id, payoutProof,
  };
}

export async function GET() {
  const accounts = config();
  if (!accounts) return Response.json({ error: "Testnet demo accounts are not configured." }, { status: 503 });
  try {
    return Response.json(await snapshot(accounts));
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const host = request.headers.get("host") ?? "";
  if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) || request.headers.get("origin") !== `http://${host}`) {
    return Response.json({ error: "Demo signing is only available from the local console." }, { status: 403 });
  }
  const accounts = config();
  if (!accounts) return Response.json({ error: "Testnet demo accounts are not configured." }, { status: 503 });
  if (busy) return Response.json({ error: "Wait for the pending transaction and refresh the dashboard." }, { status: 409 });
  busy = true;
  try {
    const { step, publicKey } = await request.json() as { step: Step; publicKey?: string };
    if (step === "connect") {
      if (!publicKey?.startsWith("ed25519:")) return Response.json({ error: "Enter an Ed25519 public key." }, { status: 400 });
      PublicKey.fromString(publicKey);
    }
    const current = await snapshot(accounts);
    const policy = current.policy;
    const hasLoss = !!policy && current.incident?.policy_id === policy.id;
    const args = { policy_id: policy?.id };
    const canBuy = current.demoOwner && (!policy || policy.phase === "Paid");
    const commands = {
      buy: { ready: canBuy, actor: accounts.owner, target: accounts.vault,
        action: call("buy_policy", {}, BigInt(current.premium)), label: "Policy activated" },
      connect: { ready: current.demoOwner && !!current.agent_funding && policy?.phase === "Active" && !current.agent,
        actor: accounts.owner, target: accounts.vault,
        action: call("connect_agent", { ...args, public_key: publicKey }, BigInt(current.agent_funding ?? "0")), label: "Agent connected" },
      revoke: { ready: current.demoOwner && !!current.agent?.connected, actor: accounts.owner, target: accounts.vault,
        action: call("revoke_agent", args, BigInt(1)), label: "Agent access revoked" },
      loss: { ready: policy?.phase === "Active" && !hasLoss, actor: accounts.runner, target: accounts.wallet,
        action: call("simulate_loss", args), label: "Simulated loss confirmed" },
      submit: { ready: !current.owner && policy?.phase === "Active" && hasLoss, actor: accounts.runner, target: accounts.vault,
        action: call("submit_claim", args), label: "Claim filed with wallet evidence" },
      review1: { ready: policy?.phase === "InReview" && policy.votes === 0, actor: accounts.reviewers[0], target: accounts.vault,
        action: call("approve_claim", args), label: "Reviewer 1 approved" },
      review2: { ready: policy?.phase === "InReview" && policy.votes === 1, actor: accounts.reviewers[1], target: accounts.vault,
        action: call("approve_claim", args), label: "Reviewer 2 approved" },
      pay: { ready: policy?.phase === "Approved", actor: accounts.runner, target: accounts.vault,
        action: call("pay_claim", args), label: "Reimbursement confirmed" },
    };
    const command = Object.hasOwn(commands, step) ? commands[step] : undefined;
    if (!command?.ready) return Response.json({ error: "This action is unavailable for the current policy state." }, { status: 409 });
    if (step === "pay") await mkdir(proofDirectory, { recursive: true, mode: 0o700 });
    const tx = await transact(command.actor, command.target, [command.action]);
    const recipient = step === "pay" ? current.beneficiary : step === "loss"
      ? (await view<Incident>(accounts.wallet, "incident")).recipient : undefined;
    const transfer = recipient && tx.receipts.find(receipt => receipt.outcome.executor_id === recipient && "SuccessValue" in receipt.outcome.status);
    const activity: Activity = { label: command.label, actor: command.actor.id, hash: tx.hash, receipt: transfer ? transfer.id : undefined };
    if (step === "pay" && policy && transfer) {
      const destination = proofFile(accounts.vault, policy.id);
      await writeFile(`${destination}.tmp`, JSON.stringify(activity), { mode: 0o600 });
      await rename(`${destination}.tmp`, destination);
    }
    return Response.json({ state: await snapshot(accounts), activity });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 502 });
  } finally {
    busy = false;
  }
}
