import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PublicKey } from "@near-js/crypto";
import { call, rpc, transact, view, type DemoAccounts } from "../../../lib/demo-near";
import { verifyLossEvidence } from "../../../lib/claim-evidence";
import { checkoutTotal, type Activity, type Dashboard, type Incident, type Mandate, type Step } from "../../../lib/demo-state";

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
    suggestedSupplier: accounts.supplier,
    demoOwner: (dashboard.owner ?? accounts.owner.id) === accounts.owner.id, payoutProof,
  };
}

export async function GET(request: Request) {
  const accounts = config();
  if (!accounts) return Response.json({ error: "Testnet demo accounts are not configured." }, { status: 503 });
  try {
    const params = new URL(request.url).searchParams;
    const lossTx = params.get("loss_tx");
    if (lossTx) return Response.json(await verifyLossEvidence(await snapshot(accounts), lossTx));
    const hash = params.get("owner_tx");
    if (hash) {
      const method = params.get("method");
      if (!method || !["buy_policy", "connect_agent", "revoke_agent", "retry_checkout_refund"].includes(method)) {
        return Response.json({ error: "Invalid owner action." }, { status: 400 });
      }
      if (!/^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(hash)) {
        return Response.json({ error: "Invalid transaction hash." }, { status: 400 });
      }
      const owner = accounts.policyOwner ?? accounts.owner.id;
      const outcome = await rpc<{
        final_execution_status: string;
        status: { Failure?: object; SuccessValue?: string };
        transaction: {
          signer_id: string; receiver_id: string; hash: string;
          actions: { FunctionCall?: { method_name: string; args: string } }[];
        };
      }>("tx", { tx_hash: hash, sender_account_id: owner, wait_until: "FINAL" });
      const transaction = outcome.transaction;
      const action = transaction.actions.length === 1 ? transaction.actions[0].FunctionCall : undefined;
      if (outcome.final_execution_status !== "FINAL" || transaction.hash !== hash ||
          transaction.signer_id !== owner || transaction.receiver_id !== accounts.vault || action?.method_name !== method) {
        return Response.json({ error: "The transaction does not match the requested owner action." }, { status: 409 });
      }
      if (method === "connect_agent" || method === "revoke_agent") {
        const args = JSON.parse(Buffer.from(action.args, "base64").toString()) as { policy_id: number; public_key?: string };
        if (String(args.policy_id) !== params.get("policy_id") ||
            (method === "connect_agent" && args.public_key !== params.get("public_key"))) {
          return Response.json({ error: "The transaction does not match the requested policy or agent key." }, { status: 409 });
        }
      }
      if (method === "buy_policy" && params.has("supplier")) {
        const args = JSON.parse(Buffer.from(action.args, "base64").toString()) as Mandate;
        if (args.supplier !== params.get("supplier") || args.limit !== params.get("limit")) {
          return Response.json({ error: "The transaction does not match the requested spending mandate." }, { status: 409 });
        }
      }
      const value = outcome.status.SuccessValue;
      if (value === undefined || Buffer.from(value, "base64").toString() === "false") {
        return Response.json({ error: "The owner transaction did not complete. Check the checkout or refund status." }, { status: 409 });
      }
    }
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
    const { step, publicKey, mandate, lossTx } = await request.json() as {
      step: Step; publicKey?: string; mandate?: Mandate; lossTx?: string;
    };
    if (step === "connect") {
      if (!publicKey?.startsWith("ed25519:")) return Response.json({ error: "Enter an Ed25519 public key." }, { status: 400 });
      PublicKey.fromString(publicKey);
    }
    const current = await snapshot(accounts);
    const policy = current.policy;
    const hasLoss = !!policy && current.incident?.policy_id === policy.id;
    const args = { policy_id: policy?.id };
    if (step === "buy" && current.max_supplier_limit && !mandate) {
      return Response.json({ error: "Choose a supplier and spending limit." }, { status: 400 });
    }
    const reviewing = step === "review1" || step === "review2";
    const evidence = reviewing && policy?.mandate
      ? await verifyLossEvidence(current, lossTx ?? policy.evidence?.transaction_hash ?? "")
      : undefined;
    const canBuy = current.demoOwner && !current.checkout && (!policy || policy.phase === "Paid");
    const commands = {
      buy: { ready: canBuy, actor: accounts.owner, target: accounts.vault,
        action: call("buy_policy", current.max_supplier_limit ? mandate ?? {} : {}, BigInt(checkoutTotal(current))), label: "Policy activated" },
      refund: { ready: current.demoOwner && current.checkout?.phase === "RefundAvailable", actor: accounts.owner, target: accounts.vault,
        action: call("retry_checkout_refund", {}), label: "Checkout refunded" },
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
        action: call("approve_claim", { ...args, evidence }), label: "Reviewer 1 approved" },
      review2: { ready: policy?.phase === "InReview" && policy.votes === 1, actor: accounts.reviewers[1], target: accounts.vault,
        action: call("approve_claim", { ...args, evidence }), label: "Reviewer 2 approved" },
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
    const activity: Activity = { label: command.label, actor: command.actor.id, hash: tx.hash, receipt: transfer ? transfer.id : undefined, policyId: policy?.id, vault: accounts.vault };
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
