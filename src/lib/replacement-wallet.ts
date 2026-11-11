import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import type { DemoAccounts } from "./demo-near";

export const replacementFile = (vault: string) => join(".agsurance-demo", `${vault}-replacement.json`);

export async function readReplacement(vault: string): Promise<DemoAccounts | null> {
  try {
    return JSON.parse(await readFile(replacementFile(vault), "utf8")) as DemoAccounts;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function selectDemoVault(root: DemoAccounts, requested: string | null): Promise<DemoAccounts | null> {
  let current: DemoAccounts | null = root;
  const visited = new Set<string>();
  while (requested && current && current.vault !== requested) {
    if (visited.has(current.vault)) throw new Error("Replacement vault configuration contains a cycle.");
    visited.add(current.vault);
    current = await readReplacement(current.vault);
  }
  return current;
}

export async function provisionReplacement(previous: DemoAccounts) {
  const wasm = process.env.AGSURANCE_WASM_DIR;
  if (!wasm) throw new Error("Set AGSURANCE_WASM_DIR to the compiled contract directory and restart the local console.");
  try {
    await promisify(execFile)(process.env.AGSURANCE_BUN_BIN ?? "bun",
      ["scripts/setup-testnet.ts", wasm, "--replacement"], {
        env: { ...process.env, AGSURANCE_DEMO_ACCOUNTS: JSON.stringify(previous) },
        timeout: 220_000,
      });
  } catch {
    throw new Error("Replacement setup did not finish. Make sure the testnet operator can fund contract storage, then retry the same setup.");
  }
  const replacement = await readReplacement(previous.vault);
  if (!replacement) throw new Error("Replacement configuration was not saved.");
  return { vault: replacement.vault, wallet: replacement.wallet };
}
