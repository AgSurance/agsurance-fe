import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { cookies } from "next/headers";
import { PublicKey } from "@near-js/crypto";
import { call, PendingTransactionError, readDashboard, reconcileTransaction, rpc, transact, TransactionFailedError, transferReceipt, view, type DemoAccounts, type SignedReference } from "../../../lib/demo-near";
import { verifyLossEvidence } from "../../../lib/claim-evidence";
import { checkoutTotal, evidenceIsCovered, projectStatus, type Activity, type Dashboard, type Mandate, type Step } from "../../../lib/demo-state";
import { clearPending, readPending, recordPending } from "../../../lib/pending-transaction";
import { demoCookie, hostedDemoOrigin, hostedJournal, hostedSteps, inviteAccounts } from "../../../lib/hosted-demo";

export const runtime = "nodejs";
export const maxDuration = 300;
let busy = false;

async function config() {
  if (process.env.VERCEL === "1") return inviteAccounts((await cookies()).get(demoCookie)?.value);

  const raw = process.env.AGSURANCE_DEMO_ACCOUNTS;
  return raw ? JSON.parse(raw) as DemoAccounts : null;
}

const proofDirectory = join(process.cwd(), ".agsurance-demo");
const pendingFile = (vault: string) => join(proofDirectory, `${vault}-pending.json`);
type ProofKind = "pay" | "recover" | "loss";
type PendingStep = SignedReference & { step: Step; label: string; policyId?: number; sender?: string; recipient?: string };
const proofFile = (vault: string, policyId: number, kind: ProofKind) =>
  join(proofDirectory, `${vault}-${policyId}${kind === "pay" ? "" : kind === "recover" ? "-recovery" : "-loss"}.json`);

async function readProof(vault: string, policyId: number, kind: ProofKind) {
  if (process.env.VERCEL === "1") return (await hostedJournal(vault).read<Activity>(`proof:${policyId}:${kind}`)) ?? undefined;
  try {
    return JSON.parse(await readFile(proofFile(vault, policyId, kind), "utf8")) as Activity;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

function readDemoPending(vault: string) {
  return process.env.VERCEL === "1" ? hostedJournal(vault).read<PendingStep>("pending")
    : readPending<PendingStep>(pendingFile(vault));
}

function saveDemoPending(vault: string, reference: PendingStep) {
  return process.env.VERCEL === "1" ? hostedJournal(vault).save("pending", reference)
    : recordPending(pendingFile(vault), reference);
}

function clearDemoPending(vault: string, reference: PendingStep) {
  return process.env.VERCEL === "1" ? hostedJournal(vault).remove("pending")
    : clearPending(pendingFile(vault), reference);
}

async function snapshot(accounts: DemoAccounts) {
  const [dashboard, pending] = await Promise.all([
    readDashboard(accounts.vault, accounts.wallet), readDemoPending(accounts.vault),
  ]);
  const policy = dashboard.policy;
  const hosted = process.env.VERCEL === "1";
  const [payoutProof, recoveryProof, lossProof] = await Promise.all([
    policy?.phase === "Paid" ? readProof(accounts.vault, policy.id, "pay") : undefined,
    policy && dashboard.coverage?.retired ? readProof(accounts.vault, policy.id, "recover") : undefined,
    hosted && policy && dashboard.incident?.policy_id === policy.id ? readProof(accounts.vault, policy.id, "loss") : undefined,
  ]);
  const status = projectStatus(dashboard, pending && {
    transactionHash: pending.transactionHash, signerId: pending.signerId,
  }, hosted);
  return {
    ...dashboard, incident: dashboard.incident ?? null, wallet: accounts.wallet, vault: accounts.vault, runner: accounts.runner.id,
    suggestedSupplier: accounts.supplier,
    demoRecovery: accounts.recovery?.id === dashboard.beneficiary,
    demoOwner: (dashboard.owner ?? accounts.owner.id) === accounts.owner.id, payoutProof, recoveryProof, lossProof, status,
  };
}

async function saveProof(vault: string, policyId: number, kind: ProofKind, activity: Activity) {
  if (process.env.VERCEL === "1") {
    await hostedJournal(vault).save(`proof:${policyId}:${kind}`, activity);
    return;
  }
  const destination = proofFile(vault, policyId, kind);
  await mkdir(proofDirectory, { recursive: true, mode: 0o700 });
  const temporary = `${destination}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(activity), { mode: 0o600 });
    await rename(temporary, destination);
  } finally {
    await rm(temporary, { force: true });
  }
}

async function finishStep(accounts: DemoAccounts, pending: PendingStep) {
  const { step, label, signerId, transactionHash, policyId, sender } = pending;
  const recipient = pending.recipient ?? (step === "loss" ? (await snapshot(accounts)).incident?.recipient : undefined);
  const receipt = sender && recipient ? await transferReceipt(pending, sender, recipient) : undefined;
  const activity = { label, actor: signerId, hash: transactionHash, receipt, policyId, vault: accounts.vault };
  const hosted = process.env.VERCEL === "1";
  if (hosted && (step === "loss" || step === "pay") && !receipt) throw new Error("The transfer receipt is not available yet.");
  if ((step === "pay" || step === "recover" || (hosted && step === "loss")) && policyId && receipt) {
    await saveProof(accounts.vault, policyId, step, activity);
  }
  const state = await snapshot(accounts);
  await clearDemoPending(accounts.vault, pending);
  state.status.pendingTransaction = null;
  return Response.json({ state, activity });
}

export async function GET(request: Request) {
  const hosted = process.env.VERCEL === "1";
  const accounts = await config();
  if (!accounts) return unavailable(hosted);
  try {
    const params = new URL(request.url).searchParams;
    const lossTx = params.get("loss_tx");
    if (lossTx) return Response.json(await verifyLossEvidence(await snapshot(accounts), lossTx));
    const hash = params.get("owner_tx");
    if (hash) {
      if (hosted) return Response.json({ error: "Use the demo signer for this session." }, { status: 403 });
      const method = params.get("method");
      const recoveryMethod = method != null && ["pause_wallet", "recover_wallet", "refund_unused_premium", "submit_claim"].includes(method);
      if (!method || (!recoveryMethod && !["buy_policy", "connect_agent", "revoke_agent", "retry_checkout_refund"].includes(method))) {
        return Response.json({ error: "Invalid owner action." }, { status: 400 });
      }
      if (!/^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(hash)) {
        return Response.json({ error: "Invalid transaction hash." }, { status: 400 });
      }
      const signer = recoveryMethod
        ? (await view<Dashboard>(accounts.vault, "dashboard")).beneficiary
        : accounts.policyOwner ?? accounts.owner.id;
      const outcome = await rpc<{
        final_execution_status: string;
        status: { Failure?: object; SuccessValue?: string };
        transaction: {
          signer_id: string; receiver_id: string; hash: string;
          actions: { FunctionCall?: { method_name: string; args: string } }[];
        };
      }>("tx", { tx_hash: hash, sender_account_id: signer, wait_until: "NONE" });
      if (outcome.final_execution_status !== "FINAL") {
        return Response.json({ code: "pending_confirmation", error: `Wallet transaction ${hash} is still awaiting finality.` }, { status: 409 });
      }
      const transaction = outcome.transaction;
      const action = transaction.actions.length === 1 ? transaction.actions[0].FunctionCall : undefined;
      if (transaction.hash !== hash ||
          transaction.signer_id !== signer || transaction.receiver_id !== accounts.vault || action?.method_name !== method) {
        return Response.json({ code: "transaction_mismatch", error: "The transaction does not match the requested owner action." }, { status: 409 });
      }
      if (recoveryMethod || method === "connect_agent" || method === "revoke_agent" || (method === "retry_checkout_refund" && params.has("policy_id"))) {
        const args = JSON.parse(Buffer.from(action.args, "base64").toString()) as { policy_id: number; public_key?: string };
        if (String(args.policy_id) !== params.get("policy_id") ||
            (method === "connect_agent" && args.public_key !== params.get("public_key"))) {
          return Response.json({ code: "transaction_mismatch", error: "The transaction does not match the requested policy or agent key." }, { status: 409 });
        }
      }
      if (method === "buy_policy" && params.has("supplier")) {
        const args = JSON.parse(Buffer.from(action.args, "base64").toString()) as Mandate;
        if (args.supplier !== params.get("supplier") || args.limit !== params.get("limit")) {
          return Response.json({ code: "transaction_mismatch", error: "The transaction does not match the requested spending mandate." }, { status: 409 });
        }
      }
      const value = outcome.status.SuccessValue;
      if (value === undefined || Buffer.from(value, "base64").toString() === "false") {
        return Response.json({ code: "transaction_failed", error: "The owner transaction did not complete. Check the checkout or refund status." }, { status: 409 });
      }
      if (method === "recover_wallet") {
        const receipt = await transferReceipt({ transactionHash: hash, signerId: signer }, accounts.wallet, signer);
        if (receipt) {
          const policyId = Number(params.get("policy_id"));
          await saveProof(accounts.vault, policyId, "recover", { label: "Wallet balance recovered", actor: signer, hash, receipt, policyId, vault: accounts.vault });
        }
      }
    }
    return Response.json(await snapshot(accounts));
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 502 });
  }
}

function unavailable(hosted: boolean) {
  return hosted ? Response.json({ error: "A demo invite is required." }, { status: 403 })
    : Response.json({ error: "Testnet demo accounts are not configured." }, { status: 503 });
}

export async function POST(request: Request) {
  const hosted = process.env.VERCEL === "1";
  const host = request.headers.get("host") ?? "";
  const allowedOrigin = hosted ? hostedDemoOrigin(request)
    : /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) && request.headers.get("origin") === `http://${host}`;
  if (!allowedOrigin) return Response.json({ error: "Invalid demo request origin." }, { status: 403 });
  const accounts = await config();
  if (!accounts) return unavailable(hosted);

  let release: (() => Promise<void>) | undefined;
  let pending: PendingStep | null = null;
  try {
    if (hosted) {
      release = await hostedJournal(accounts.vault).acquire();
    } else if (!busy) {
      busy = true;
      release = async () => { busy = false; };
    }
    if (!release) return Response.json({ error: "Wait for the pending transaction and refresh the dashboard." }, { status: 409 });

    const { step, publicKey, mandate, lossTx, expectedPolicyId, expectedCheckoutId } = await request.json() as {
      step: Step | "reconcile"; publicKey?: string; mandate?: Mandate; lossTx?: string;
      expectedPolicyId?: number | null; expectedCheckoutId?: number | null;
    };
    if (hosted && !hostedSteps.has(step)) {
      return Response.json({ error: "This action is unavailable in the hosted demo." }, { status: 403 });
    }
    pending = await readDemoPending(accounts.vault);
    if (pending) {
      if (step !== "reconcile") throw new PendingTransactionError(pending);
      await reconcileTransaction(pending);
      return await finishStep(accounts, pending);
    }
    if (step === "reconcile") return Response.json({ error: "There is no pending transaction." }, { status: 409 });
    if (step === "connect") {
      if (!publicKey?.startsWith("ed25519:")) return Response.json({ error: "Enter an Ed25519 public key." }, { status: 400 });
      PublicKey.fromString(publicKey);
    }
    const current = await snapshot(accounts);
    const policy = current.policy;
    const { status } = current;
    if (expectedPolicyId !== status.policyId || (step === "refund" && expectedCheckoutId !== status.checkoutPolicyId)) {
      return Response.json({ code: "stale_policy", error: "The policy or checkout changed. Refresh before taking this action." }, { status: 409 });
    }
    if (status.actions[step] !== "available") {
      return Response.json({ code: status.actions[step], error: "This action is unavailable for the current policy state." }, { status: 409 });
    }
    const args = { policy_id: expectedPolicyId ?? undefined };
    if (step === "buy" && current.max_supplier_limit && !mandate) {
      return Response.json({ error: "Choose a supplier and spending limit." }, { status: 400 });
    }
    if (hosted && step === "buy" &&
        (mandate?.supplier !== accounts.supplier || mandate?.limit !== current.max_supplier_limit)) {
      return Response.json({ error: "Use the spending rules shown for this testnet demo." }, { status: 400 });
    }
    const reviewing = step === "review1" || step === "review2" || step === "review3";
    const evidence = reviewing && policy?.mandate
      ? await verifyLossEvidence(current, (hosted ? current.lossProof?.hash : lossTx ?? policy.evidence?.transaction_hash) ?? "")
      : undefined;
    const reject = !!evidence && !evidenceIsCovered(current, evidence);
    const vote = call(reject ? "reject_claim" : "approve_claim", { ...args, evidence });
    const recovery = current.demoRecovery ? accounts.recovery : undefined;
    const owner = current.demoOwner ? accounts.owner : undefined;
    const voteLabel = reject ? "voted to reject" : "approved";
    const commands = {
      buy: { actor: owner, target: accounts.vault,
        action: call("buy_policy", { ...(mandate ?? {}), expected_policy_id: expectedPolicyId ?? 0 }, BigInt(checkoutTotal(current))), label: "Policy activated" },
      refund: { actor: owner, target: accounts.vault,
        action: call("retry_checkout_refund", { policy_id: expectedCheckoutId }), label: "Checkout refunded" },
      connect: { actor: owner, target: accounts.vault,
        action: call("connect_agent", { ...args, public_key: publicKey }, BigInt(current.agent_funding ?? "0")), label: "Agent connected" },
      revoke: { actor: owner, target: accounts.vault,
        action: call("revoke_agent", args, BigInt(1)), label: "Agent access revoked" },
      pause: { actor: recovery, target: accounts.vault,
        action: call("pause_wallet", args), label: "Agent access stopped" },
      recover: { actor: recovery, target: accounts.vault, action: call("recover_wallet", args), label: "Wallet balance recovered" },
      "premium-refund": { actor: recovery, target: accounts.vault,
        action: call("refund_unused_premium", args), label: "Unused premium refunded" },
      "recovery-claim": { actor: recovery, target: accounts.vault,
        action: call("submit_claim", args), label: "Recovery account filed claim" },
      loss: { actor: accounts.runner, target: accounts.wallet,
        action: call("simulate_loss", args), label: "Simulated loss confirmed" },
      submit: { actor: hosted ? owner : accounts.runner, target: accounts.vault,
        action: call("submit_claim", args), label: "Claim filed with wallet evidence" },
      review1: { actor: accounts.reviewers[0], target: accounts.vault, action: vote, label: `Reviewer 1 ${voteLabel}` },
      review2: { actor: accounts.reviewers[1], target: accounts.vault, action: vote, label: `Reviewer 2 ${voteLabel}` },
      review3: { actor: accounts.reviewers[2], target: accounts.vault, action: vote, label: `Reviewer 3 ${voteLabel}` },
      escalate: { actor: accounts.runner, target: accounts.vault, action: call("escalate_claim", args), label: "Claim escalation recorded" },
      pay: { actor: accounts.runner, target: accounts.vault, action: call("pay_claim", args), label: "Reimbursement confirmed" },
      close: { actor: accounts.runner, target: accounts.vault, action: call("close_policy", args), label: "Policy closed and reserve released" },
    };
    const command = Object.hasOwn(commands, step) ? commands[step] : undefined;
    if (!command?.actor) return Response.json({ error: "This action requires a different signer." }, { status: 409 });
    const sender = step === "pay" ? current.reserve_pool ?? current.vault
      : step === "loss" || step === "recover" ? current.wallet
        : step === "premium-refund" ? current.vault : undefined;
    const recipient = ["pay", "recover", "premium-refund"].includes(step) ? current.beneficiary : undefined;
    await transact(command.actor, command.target, [command.action], async reference => {
      const entry = { ...reference, step, label: command.label, policyId: policy?.id, sender, recipient };
      await saveDemoPending(accounts.vault, entry);
      pending = entry;
    });
    if (!pending) throw new Error("Missing transaction reference");
    return await finishStep(accounts, pending);
  } catch (error) {
    if (error instanceof TransactionFailedError && pending) {
      await clearDemoPending(accounts.vault, pending);
      return Response.json({ code: "transaction_failed", error: error.message }, { status: 409 });
    }
    if (pending || error instanceof PendingTransactionError) {
      const reference = pending ?? (error as PendingTransactionError).reference;
      return Response.json({
        code: "pending_confirmation",
        error: `Check transaction ${reference.transactionHash} before retrying.`,
        transactionHash: reference.transactionHash,
        signerId: reference.signerId,
      }, { status: 409 });
    }
    return Response.json({ error: (error as Error).message }, { status: 502 });
  } finally {
    await release?.().catch(() => undefined);
  }
}
