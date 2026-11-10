import { createHash } from "node:crypto";
import { KeyPair, PublicKey } from "@near-js/crypto";
import { actionCreators, createTransaction, Signature, SignedTransaction, type Action } from "@near-js/transactions";
import { baseEncode } from "@near-js/utils";

import { CHECKOUT_GAS, TESTNET_RPC, type Dashboard, type Incident, type ReserveStatus, type TransactionReference } from "./demo-state";

export const actions = actionCreators;
const testnetRpc = process.env.AGSURANCE_TESTNET_RPC ?? TESTNET_RPC;
export const milliNear = BigInt(10) ** BigInt(21);
export const call = (method: string, args: object, deposit = BigInt(0)) =>
  actions.functionCall(method, args, BigInt(method === "buy_policy" ? CHECKOUT_GAS : "75000000000000"), deposit);

export type Actor = { id: string; key: string };
export type DemoAccounts = {
  owner: Actor;
  policyOwner?: string;
  supplier?: string;
  recovery?: Actor;
  runner: Actor;
  reviewers: [Actor, Actor, Actor];
  wallet: string;
  vault: string;
  pool?: string;
};

export async function rpc<T>(method: string, params: object): Promise<T> {
  const response = await fetch(testnetRpc, {
    method: "POST", headers: { "content-type": "application/json" }, cache: "no-store",
    body: JSON.stringify({ jsonrpc: "2.0", id: "agsurance-demo", method, params }),
    signal: AbortSignal.timeout(45000),
  });
  const body = await response.json() as { result?: T; error?: { message?: string; cause?: { name?: string } } };
  if (!response.ok || body.result === undefined) {
    throw new Error(`NEAR RPC ${method}: ${body.error?.cause?.name ?? body.error?.message ?? response.status}`);
  }
  return body.result;
}

async function query<T>(account: string, method: string, args: object, blockHash?: string) {
  const result = await rpc<{ result: number[]; block_hash: string; block_height: number }>("query", {
    request_type: "call_function", ...(blockHash ? { block_id: blockHash } : { finality: "final" }), account_id: account,
    method_name: method, args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
  });
  return { data: JSON.parse(Buffer.from(result.result).toString()) as T, blockHash: result.block_hash, blockHeight: result.block_height };
}

export async function view<T>(account: string, method: string, args: object = {}, blockHash?: string): Promise<T> {
  return (await query<T>(account, method, args, blockHash)).data;
}

export async function readDashboard(vault: string, walletFallback?: string) {
  const { data: dashboard, blockHash, blockHeight } = await query<Dashboard>(vault, "dashboard", {});
  const wallet = dashboard.wallet ?? walletFallback;
  const [incident, reserveStatus, operatingBalance] = await Promise.all([
    wallet ? view<Incident | null>(wallet, "incident", {}, blockHash) : undefined,
    dashboard.reserve_pool ? view<ReserveStatus>(dashboard.reserve_pool, "reserve_status", {}, blockHash) : undefined,
    wallet && dashboard.coverage ? view<string>(wallet, "operating_balance", {}, blockHash) : undefined,
  ]);
  return { ...dashboard, blockHeight, incident, reserveStatus, operatingBalance };
}

export class PendingTransactionError extends Error {
  constructor(readonly reference: TransactionReference) {
    super(`NEAR confirmation is pending for ${reference.transactionHash}. Check this transaction before retrying.`);
  }
}

export class TransactionFailedError extends Error {}
export type SignedReference = TransactionReference & { signedTransaction?: string };

type Outcome = {
  final_execution_status: string;
  transaction: { hash: string };
  status: { SuccessValue?: string; Failure?: object };
  receipts_outcome: { id: string; outcome: { executor_id: string; status: object } }[];
};

function finalized(reference: TransactionReference, outcome: Outcome) {
  if (outcome.final_execution_status !== "FINAL" || outcome.transaction?.hash !== reference.transactionHash) {
    throw new PendingTransactionError(reference);
  }
  if (outcome.status.SuccessValue === undefined) {
    throw new TransactionFailedError(`NEAR execution failed for ${reference.transactionHash}: ${JSON.stringify(outcome.status.Failure)}`);
  }
  const value = Buffer.from(outcome.status.SuccessValue, "base64").toString();
  if (value === "false") throw new TransactionFailedError(`NEAR operation did not complete (${reference.transactionHash})`);
  return { hash: reference.transactionHash, receipts: outcome.receipts_outcome };
}

export async function reconcileTransaction(reference: SignedReference) {
  let outcome;
  try {
    outcome = await rpc<Outcome>("tx", {
      tx_hash: reference.transactionHash, sender_account_id: reference.signerId, wait_until: "NONE",
    });
  } catch (error) {
    if (reference.signedTransaction && error instanceof Error && error.message === "NEAR RPC tx: UNKNOWN_TRANSACTION") {
      try {
        outcome = await rpc<Outcome>("send_tx", { signed_tx_base64: reference.signedTransaction, wait_until: "FINAL" });
      } catch {
        throw new PendingTransactionError(reference);
      }
      return finalized(reference, outcome);
    }
    throw new PendingTransactionError(reference);
  }
  return finalized(reference, outcome);
}

export async function transferReceipt(reference: TransactionReference, sender: string, recipient: string) {
  const result = await rpc<Outcome & {
    receipts: { receipt_id: string; predecessor_id: string; receiver_id: string;
      receipt: { Action?: { actions: { Transfer?: { deposit: string } }[] } } }[];
  }>("EXPERIMENTAL_tx_status", {
    tx_hash: reference.transactionHash, sender_account_id: reference.signerId, wait_until: "FINAL",
  });
  finalized(reference, result);
  if (!result.receipts) throw new Error("The RPC did not return transaction receipts.");
  return result.receipts.find(receipt =>
    receipt.predecessor_id === sender && receipt.receiver_id === recipient &&
    receipt.receipt.Action?.actions.some(action => action.Transfer) &&
    result.receipts_outcome.some(outcome => outcome.id === receipt.receipt_id && "SuccessValue" in outcome.outcome.status)
  )?.receipt_id;
}

export async function transact(
  actor: Actor, receiver: string, transactionActions: Action[],
  beforeBroadcast?: (reference: SignedReference) => Promise<void>,
) {
  if (![actor.id, receiver].every(id => id.endsWith(".testnet"))) throw new Error("Only named testnet accounts are allowed");
  const key = KeyPair.fromString(actor.key as `ed25519:${string}`);
  const publicKey = key.getPublicKey();
  const access = await rpc<{ nonce: number; block_hash: string }>("query", {
    request_type: "view_access_key", finality: "final", account_id: actor.id, public_key: publicKey.toString(),
  });
  const blockHash = PublicKey.fromString(`ed25519:${access.block_hash}`).data;
  const transaction = createTransaction(actor.id, publicKey, receiver, BigInt(access.nonce) + BigInt(1), transactionActions, blockHash);
  const digest = createHash("sha256").update(transaction.encode()).digest();
  const reference = { transactionHash: baseEncode(digest), signerId: actor.id };
  const signature = new Signature({ keyType: publicKey.keyType, data: key.sign(digest).signature });
  const signed = new SignedTransaction({ transaction, signature });
  const signedTransaction = Buffer.from(signed.encode()).toString("base64");
  await beforeBroadcast?.({ ...reference, signedTransaction });
  let outcome;
  try {
    outcome = await rpc<Outcome>("send_tx", { signed_tx_base64: signedTransaction, wait_until: "FINAL" });
  } catch (error) {
    if (error instanceof Error && error.message === "NEAR RPC send_tx: INVALID_TRANSACTION") {
      throw new TransactionFailedError(`NEAR rejected transaction ${reference.transactionHash}`);
    }
    return reconcileTransaction(reference);
  }
  return finalized(reference, outcome);
}
