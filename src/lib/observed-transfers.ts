import { evidenceIsCovered, type DemoState, type TransactionReference, type TransferEvidence } from "./demo-state";
import { rpc, view } from "./demo-near";

const chainHash = /^[1-9A-HJ-NP-Za-km-z]{43,44}$/;
const accountId = /^(?=.{2,64}$)[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const indexer = "https://api-testnet.nearblocks.io/v3";

type NativeAction = { Transfer?: { deposit: string }; FunctionCall?: { method_name: string } };
type Execution = { id: string; block_hash: string; outcome: {
  status: { SuccessValue?: string }; receipt_ids: string[];
} };
type Transaction = {
  final_execution_status: string;
  transaction: { hash: string; signer_id: string };
  receipts: {
    receipt_id: string; predecessor_id: string; receiver_id: string;
    receipt: { Action?: { actions: NativeAction[] } };
  }[];
  receipts_outcome: Execution[];
};

function assertReference(ref: TransactionReference) {
  if (!chainHash.test(ref.transactionHash) || !accountId.test(ref.signerId)) {
    throw new Error("Enter a transaction hash and its signer account.");
  }
}

export function orderTransfers(transfers: TransferEvidence[]) {
  const unique = new Map(transfers.map(transfer => [`${transfer.receipt.receipt_id}/${transfer.action_index}`, transfer]));
  return [...unique.values()].sort((a, b) =>
    a.receipt.receipt_id < b.receipt.receipt_id ? -1 : a.receipt.receipt_id > b.receipt.receipt_id ? 1 : a.action_index - b.action_index);
}

export async function inspectObservedTransfers(state: DemoState, refs: TransactionReference[]): Promise<TransferEvidence[]> {
  const policy = state.policy;
  if (!policy?.mandate || !state.wallet_code_hash) throw new Error("This vault has no pinned wallet code or policy mandate.");
  if (!refs.length || refs.length > 8) throw new Error("Enter one to eight transaction references.");
  refs.forEach(assertReference);
  const mandate = await view<typeof policy.mandate>(state.vault, "mandate", { policy_id: policy.id });
  if (!mandate || mandate.supplier !== policy.mandate.supplier || mandate.limit !== policy.mandate.limit) {
    throw new Error("The historical mandate does not match this policy.");
  }
  const history = new Map<string, Promise<{ code_hash: string; height: number; timestamp: number }>>();
  function lookup(blockHash: string) {
    let result = history.get(blockHash);
    if (!result) {
      result = Promise.all([
        rpc<{ header: { height: number; timestamp_nanosec: string } }>("block", { block_id: blockHash }),
        rpc<{ code_hash: string }>("query", { request_type: "view_account", account_id: state.wallet, block_id: blockHash }),
      ]).then(([block, account]) => ({
        code_hash: account.code_hash, height: block.header.height,
        timestamp: Number(BigInt(block.header.timestamp_nanosec) / BigInt(1_000_000)),
      }));
      history.set(blockHash, result);
    }
    return result;
  }
  const transactions = await Promise.all(refs.map(async ref => {
    const transaction = await rpc<Transaction>("EXPERIMENTAL_tx_status", {
      tx_hash: ref.transactionHash, sender_account_id: ref.signerId, wait_until: "FINAL",
    });
    if (transaction.final_execution_status !== "FINAL" || transaction.transaction.hash !== ref.transactionHash
      || transaction.transaction.signer_id !== ref.signerId || !Array.isArray(transaction.receipts)) {
      throw new Error("NEAR did not return the finalized transaction and its receipts.");
    }
    const successful = new Map(transaction.receipts_outcome.map(outcome => [outcome.id, outcome]));
    const recoveryReceipts = new Set<string>();
    for (const parent of transaction.receipts) {
      if (parent.receiver_id === state.wallet && parent.predecessor_id === state.vault &&
          parent.receipt.Action?.actions.some(action => action.FunctionCall?.method_name === "recover_balance")) {
        for (const child of successful.get(parent.receipt_id)?.outcome.receipt_ids ?? []) recoveryReceipts.add(child);
      }
    }
    const transfers: TransferEvidence[] = [];
    for (const receipt of transaction.receipts) {
      const execution = successful.get(receipt.receipt_id);
      if (receipt.predecessor_id !== state.wallet || execution?.outcome.status.SuccessValue === undefined) continue;
      if (recoveryReceipts.has(receipt.receipt_id) && receipt.receiver_id === state.beneficiary) continue;
      const actions = receipt.receipt.Action?.actions ?? [];
      for (const [action_index, action] of actions.entries()) {
        const amount = action.Transfer?.deposit;
        if (!amount || !/^[1-9]\d*$/.test(amount)) continue;
        if (receipt.receiver_id === mandate.supplier && BigInt(amount) <= BigInt(mandate.limit)) continue;
        const block = await lookup(execution.block_hash);
        if (block.code_hash !== state.wallet_code_hash) continue;
        const evidence = {
          transaction_hash: ref.transactionHash, receipt_id: receipt.receipt_id, recipient: receipt.receiver_id,
          amount, block_height: block.height, block_timestamp_ms: block.timestamp,
        };
        if (evidenceIsCovered(state, evidence)) transfers.push({ receipt: evidence, action_index, signer_id: ref.signerId });
      }
    }
    return transfers;
  }));
  return orderTransfers(transactions.flat());
}

export async function verifyObservedClaim(state: DemoState) {
  const bundle = state.policy?.observed_claim;
  if (!bundle) throw new Error("The policy has no submitted transfer bundle.");
  const refs = new Map(bundle.transfers.map(({ receipt, signer_id }) => [
    receipt.transaction_hash, { transactionHash: receipt.transaction_hash, signerId: signer_id },
  ]));
  const verified = await inspectObservedTransfers(state, [...refs.values()]);
  return bundle.transfers.every(transfer => verified.some(candidate =>
    candidate.action_index === transfer.action_index && candidate.signer_id === transfer.signer_id
    && candidate.receipt.transaction_hash === transfer.receipt.transaction_hash
    && candidate.receipt.receipt_id === transfer.receipt.receipt_id && candidate.receipt.recipient === transfer.receipt.recipient
    && candidate.receipt.amount === transfer.receipt.amount && candidate.receipt.block_height === transfer.receipt.block_height
    && candidate.receipt.block_timestamp_ms === transfer.receipt.block_timestamp_ms,
  ));
}

type IndexRow = { transaction_hash?: string; originated_from_transaction_hash?: string; signer_account_id?: string };
async function indexRows(path: string): Promise<IndexRow[]> {
  const token = process.env.AGSURANCE_NEARBLOCKS_API_KEY;
  const response = await fetch(`${indexer}${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
    cache: "no-store", signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`NearBlocks returned HTTP ${response.status}.`);
  const body = await response.json() as { data?: IndexRow[] | IndexRow };
  if (!body.data) throw new Error("NearBlocks returned no transaction data.");
  return Array.isArray(body.data) ? body.data : [body.data];
}

export async function watchWallet(state: DemoState) {
  const wallet = encodeURIComponent(state.wallet);
  const receipts = await indexRows(`/accounts/${wallet}/receipts?limit=8`);
  const transactions = await indexRows(`/accounts/${wallet}/txns?limit=8`);
  const refs = new Map<string, string | undefined>();
  for (const row of [...receipts, ...transactions]) {
    const hash = row.originated_from_transaction_hash ?? row.transaction_hash;
    if (!hash || !chainHash.test(hash)) continue;
    refs.set(hash, row.signer_account_id ?? refs.get(hash));
    if (refs.size === 8) break;
  }
  const located: TransactionReference[] = [];
  for (const [transactionHash, indexedSigner] of refs) {
    const [row] = indexedSigner ? [] : await indexRows(`/txns/${transactionHash}`);
    const signerId = indexedSigner ?? row?.signer_account_id;
    if (!signerId) throw new Error("NearBlocks did not return the transaction signer.");
    located.push({ transactionHash, signerId });
  }
  return located.length ? inspectObservedTransfers(state, located) : [];
}
