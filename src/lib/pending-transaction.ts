import { randomUUID } from "node:crypto";
import { link, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { TransactionReference } from "./demo-state";

export async function readPending<T extends TransactionReference>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return null;
  }
}

export async function recordPending<T extends TransactionReference>(file: string, reference: T) {
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(reference), { mode: 0o600, flag: "wx" });
    await link(temporary, file);
  } finally {
    await rm(temporary, { force: true });
  }
}

export async function clearPending(file: string, reference: TransactionReference) {
  const current = await readPending(file);
  if (current?.transactionHash === reference.transactionHash) await rm(file, { force: true });
}
