"use client";

import { useState } from "react";

const command = "bun run verify:receipts";

export function ReceiptCommand() {
  const [message, setMessage] = useState("");

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(command);
      setMessage("Command copied.");
    } catch {
      setMessage("Could not copy. Select the command to copy it manually.");
    }
  }

  return (
    <div className="demo-command demo-receipt-command">
      <div>
        <code>{command}</code>
        <button type="button" onClick={copyCommand}>Copy command</button>
      </div>
      <span role="status">{message}</span>
    </div>
  );
}
