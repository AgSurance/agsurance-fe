import { call, transact, view, type DemoAccounts } from "../../../lib/demo-near";
import type { Activity, Dashboard, Incident, Step } from "../../../lib/demo-state";

export const runtime = "nodejs";
let busy = false;

function config(): DemoAccounts | null {
  const raw = process.env.AGSURANCE_DEMO_ACCOUNTS;
  return raw ? JSON.parse(raw) as DemoAccounts : null;
}

async function snapshot(accounts: DemoAccounts) {
  const [dashboard, incident] = await Promise.all([
    view<Dashboard>(accounts.vault, "dashboard"), view<Incident | null>(accounts.wallet, "incident"),
  ]);
  return { ...dashboard, incident, wallet: accounts.wallet, vault: accounts.vault, runner: accounts.runner.id };
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
    const { step } = await request.json() as { step: Step };
    const current = await snapshot(accounts);
    const policy = current.policy;
    const hasLoss = !!policy && current.incident?.policy_id === policy.id;
    const args = { policy_id: policy?.id };
    const commands = {
      buy: { ready: !policy || policy.phase === "Paid", actor: accounts.owner, target: accounts.vault,
        action: call("buy_policy", {}, BigInt(current.premium)), label: "Policy activated" },
      loss: { ready: policy?.phase === "Active" && !hasLoss, actor: accounts.runner, target: accounts.wallet,
        action: call("simulate_loss", args), label: "Simulated loss confirmed" },
      submit: { ready: policy?.phase === "Active" && hasLoss, actor: accounts.runner, target: accounts.vault,
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
    const tx = await transact(command.actor, command.target, [command.action]);
    const recipient = step === "pay" ? current.beneficiary : step === "loss"
      ? (await view<Incident>(accounts.wallet, "incident")).recipient : undefined;
    const transfer = recipient && tx.receipts.find(receipt => receipt.outcome.executor_id === recipient && "SuccessValue" in receipt.outcome.status);
    const activity: Activity = { label: command.label, actor: command.actor.id, hash: tx.hash, receipt: transfer ? transfer.id : undefined };
    return Response.json({ state: await snapshot(accounts), activity });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 502 });
  } finally {
    busy = false;
  }
}
