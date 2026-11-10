import { rpc, view } from "./demo-near";
import type { DemoState, Evidence, Mandate } from "./demo-state";

type Receipt = {
  receipt_id: string;
  predecessor_id: string;
  receiver_id: string;
  receipt: { Action?: { actions: { Transfer?: { deposit: string } }[] } };
};

export async function verifyLossEvidence(current: DemoState, transactionHash: string): Promise<Evidence> {
  const policy = current.policy;
  const incident = policy?.incident;
  if (!policy?.mandate || !incident || policy.activation_height === undefined) {
    throw new Error("Missing policy mandate or recorded incident.");
  }
  if (!/^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(transactionHash)) throw new Error("Enter the testnet loss transaction hash.");

  const [mandate, result] = await Promise.all([
    view<Mandate | null>(current.vault, "mandate", { policy_id: policy.id }),
    rpc<{
      final_execution_status: string;
      status: { SuccessValue?: string };
      transaction: {
        hash: string; signer_id: string; receiver_id: string;
        actions: { FunctionCall?: { method_name: string; args: string } }[];
      };
      receipts: Receipt[];
      receipts_outcome: { id: string; block_hash: string; outcome: { status: { SuccessValue?: string } } }[];
    }>("EXPERIMENTAL_tx_status", { tx_hash: transactionHash, sender_account_id: current.runner, wait_until: "FINAL" }),
  ]);
  const tx = result.transaction;
  const action = tx.actions.length === 1 ? tx.actions[0].FunctionCall : undefined;
  if (result.final_execution_status !== "FINAL" || result.status.SuccessValue === undefined ||
      tx.hash !== transactionHash || tx.signer_id !== current.runner || tx.receiver_id !== current.wallet ||
      action?.method_name !== "simulate_loss" ||
      JSON.parse(Buffer.from(action.args, "base64").toString()).policy_id !== policy.id) {
    throw new Error("The transaction is not the finalized loss for this policy.");
  }
  if (!mandate || mandate.supplier !== policy.mandate.supplier || mandate.limit !== policy.mandate.limit) {
    throw new Error("The historical mandate does not match this policy.");
  }

  const receipts = result.receipts?.filter(receipt => {
    const actions = receipt.receipt.Action?.actions;
    return receipt.predecessor_id === current.wallet && receipt.receiver_id === incident.recipient &&
      actions?.length === 1 && actions[0].Transfer?.deposit === incident.amount;
  });
  if (receipts?.length !== 1) throw new Error("Could not locate one matching wallet transfer receipt.");
  const receipt = receipts[0];
  const outcome = result.receipts_outcome.find(entry => entry.id === receipt.receipt_id);
  if (outcome?.outcome.status.SuccessValue === undefined) throw new Error("The transfer receipt failed.");

  const block = await rpc<{ header: { height: number; timestamp_nanosec: string } }>("block", { block_id: outcome.block_hash });
  const height = block.header.height;
  if ((!current.coverage?.window_seconds && height < policy.activation_height) || height > incident.block_height) {
    throw new Error("The transfer block falls outside the recorded policy incident.");
  }
  if (incident.recipient === mandate.supplier && BigInt(incident.amount) <= BigInt(mandate.limit)) {
    throw new Error("The transfer matches the policy mandate.");
  }
  return {
    transaction_hash: transactionHash, receipt_id: receipt.receipt_id, block_height: height,
    recipient: incident.recipient, amount: incident.amount,
    block_timestamp_ms: Number(BigInt(block.header.timestamp_nanosec) / BigInt(1_000_000)),
  };
}
