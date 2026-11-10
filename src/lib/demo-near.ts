import { createHash } from "node:crypto";
import { KeyPair, PublicKey } from "@near-js/crypto";
import { actionCreators, createTransaction, Signature, SignedTransaction, type Action } from "@near-js/transactions";

import { CHECKOUT_GAS, TESTNET_RPC } from "./demo-state";

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

export async function view<T>(account: string, method: string, args: object = {}): Promise<T> {
  const result = await rpc<{ result: number[] }>("query", {
    request_type: "call_function", finality: "final", account_id: account,
    method_name: method, args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
  });
  return JSON.parse(Buffer.from(result.result).toString()) as T;
}

export async function transact(actor: Actor, receiver: string, transactionActions: Action[]) {
  if (![actor.id, receiver].every(id => id.endsWith(".testnet"))) throw new Error("Only named testnet accounts are allowed");
  const key = KeyPair.fromString(actor.key as `ed25519:${string}`);
  const publicKey = key.getPublicKey();
  const access = await rpc<{ nonce: number; block_hash: string }>("query", {
    request_type: "view_access_key", finality: "final", account_id: actor.id, public_key: publicKey.toString(),
  });
  const blockHash = PublicKey.fromString(`ed25519:${access.block_hash}`).data;
  const transaction = createTransaction(actor.id, publicKey, receiver, BigInt(access.nonce) + BigInt(1), transactionActions, blockHash);
  const digest = createHash("sha256").update(transaction.encode()).digest();
  const signature = new Signature({ keyType: publicKey.keyType, data: key.sign(digest).signature });
  const signed = new SignedTransaction({ transaction, signature });
  const outcome = await rpc<{
    transaction: { hash: string };
    status: { SuccessValue?: string; Failure?: object };
    receipts_outcome: { id: string; outcome: { executor_id: string; status: object } }[];
  }>("send_tx", { signed_tx_base64: Buffer.from(signed.encode()).toString("base64"), wait_until: "FINAL" });
  if (outcome.status.SuccessValue === undefined) {
    throw new Error(`NEAR execution failed for ${outcome.transaction.hash}: ${JSON.stringify(outcome.status.Failure)}`);
  }
  const value = Buffer.from(outcome.status.SuccessValue, "base64").toString();
  if (value === "false") throw new Error(`NEAR operation did not complete (${outcome.transaction.hash})`);
  return { hash: outcome.transaction.hash, receipts: outcome.receipts_outcome };
}
