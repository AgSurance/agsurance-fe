import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { DemoAccounts } from "../src/lib/demo-near";

const [destination, ...files] = process.argv.slice(2);
if (!destination || !files.length) throw new Error("Pass a new private output directory and one .env.local file per invite.");

const invites: Record<string, DemoAccounts> = {};
const codes: string[] = [];
const accountsInUse = new Set<string>();

for (const file of files) {
  const raw = (await readFile(file, "utf8")).match(/^AGSURANCE_DEMO_ACCOUNTS='(.+)'$/m)?.[1];
  if (!raw) throw new Error(`Missing AGSURANCE_DEMO_ACCOUNTS in ${file}`);
  const accounts = JSON.parse(raw) as DemoAccounts;
  if ((accounts.policyOwner ?? accounts.owner.id) !== accounts.owner.id || !accounts.supplier || !accounts.pool || !accounts.recovery) {
    throw new Error("Use a complete testnet demo configuration with its own demo owner.");
  }

  const signers = [accounts.owner, accounts.runner, accounts.recovery, ...accounts.reviewers];
  const ids = [...signers.map(actor => actor.id), accounts.wallet, accounts.vault, accounts.pool, accounts.supplier];
  for (const id of ids) {
    if (!id.endsWith(".testnet") || accountsInUse.has(id)) throw new Error("Each invite needs separate testnet accounts.");
    accountsInUse.add(id);
  }

  const code = randomBytes(32).toString("hex");
  invites[createHash("sha256").update(code).digest("hex")] = accounts;
  codes.push(code);
}

await mkdir(destination, { mode: 0o700 });
await writeFile(join(destination, "accounts.json"), JSON.stringify(invites), { flag: "wx", mode: 0o600 });
await writeFile(join(destination, "invite-codes.txt"), `${codes.join("\n")}\n`, { flag: "wx", mode: 0o600 });
console.log(`Prepared ${codes.length} invite codes in ${destination}.`);
