import type { ReserveStatus } from "../../../lib/demo-state";
import { readDashboard, reconcileTransaction, TransactionFailedError, view } from "../../../lib/demo-near";
import { manualDemoContracts, type CapitalStatus, type ManualSetup, type ManualSnapshot, type PoolCapacity } from "../../../lib/manual-demo";

export const dynamic = "force-dynamic";

const accountId = /^(?:[a-z0-9]+(?:[._-][a-z0-9]+)*\.testnet|[0-9a-f]{64})$/;
const chainHash = /^[1-9A-HJ-NP-Za-km-z]{43,44}$/;

export async function GET(request: Request) {
  const { factory, capitalPool, supplier } = manualDemoContracts();
  const query = new URL(request.url).searchParams;
  const account = query.get("account");
  if (!account || account.length > 64 || !accountId.test(account)) {
    return Response.json({ error: "Use a NEAR testnet account." }, { status: 400 });
  }

  const hash = query.get("transaction");
  if (hash) {
    if (!chainHash.test(hash)) return Response.json({ error: "Invalid transaction hash." }, { status: 400 });
    try {
      await reconcileTransaction({ transactionHash: hash, signerId: account });
      return Response.json({ status: "confirmed" });
    } catch (error) {
      return Response.json({ status: error instanceof TransactionFailedError ? "failed" : "pending" });
    }
  }

  const result: ManualSnapshot = { errors: [] };
  // Old testnet factories predate pool_config. Keep their existing paths available.
  const readPool = async () => {
    const config = factory
      ? await view<[string, string] | null>(factory, "pool_config").catch(() => null)
      : null;
    const pool = config?.[0] ?? capitalPool;
    if (!pool) return;
    const [capital, capacity, reserve] = await Promise.all([
      view<CapitalStatus | null>(pool, "capital_status", { account_id: account }),
      config && view<PoolCapacity>(pool, "pool_capacity", { group: config[1] }),
      config && view<ReserveStatus>(pool, "reserve_status"),
    ]);
    if (!config && capital?.rolling) throw new Error("Factory pool unavailable");
    result.fundingPool = pool;
    result.capital = capital;
    if (capacity && reserve) {
      result.poolCapacity = capacity;
      result.poolReserve = reserve;
    }
  };
  const [buyer, funding] = await Promise.allSettled([
    factory ? Promise.all([
      view<string>(factory, "setup_deposit"),
      view<ManualSetup | null>(factory, "setup", { owner: account }),
    ]) : undefined,
    readPool(),
  ]);
  if (buyer.status === "fulfilled" && buyer.value) {
    const [setupDeposit, setup] = buyer.value;
    result.setupDeposit = setupDeposit;
    result.setup = setup;
    if (setup?.stage === "Ready") {
      try {
        const dashboard = await readDashboard(setup.vault, setup.wallet);
        result.dashboard = { ...dashboard, wallet: setup.wallet, vault: setup.vault,
          incident: dashboard.incident ?? null, runner: "", suggestedSupplier: supplier, demoOwner: false };
      } catch {
        result.errors.push("The wallet dashboard is temporarily unavailable.");
      }
    }
  } else if (buyer.status === "rejected") {
    result.errors.push("Could not read the wallet setup on NEAR testnet.");
  }
  if (funding.status === "rejected") result.errors.push("Could not read the capital pool on NEAR testnet.");
  return Response.json(result);
}
