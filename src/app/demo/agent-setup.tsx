export function AgentSetup({ vault, funding }: { vault?: string; funding?: string }) {
  const target = vault ?? "YOUR_VAULT.testnet";

  return (
    <section className="demo-panel demo-manual" id="agent-setup" aria-labelledby="agent-setup-heading">
      <h2 id="agent-setup-heading">Connect an agent</h2>
      <ol className="demo-steps">
        <li>Buy a policy with the owner wallet.</li>
        <li>From the frontend repo in the agent runtime, install dependencies with Bun and create a key.
          <div className="demo-command"><code>bun install --frozen-lockfile</code><code>bun scripts/agent.ts init .agsurance-agent.key</code></div>
        </li>
        <li>Copy the public key the CLI prints. Paste it under <strong>Connect Agent</strong> in your policy dashboard and approve the wallet transaction{funding ? ` (${funding} to fund the agent account, plus gas)` : ""}. Keep the private key file in the agent runtime.</li>
        <li>Once the dashboard confirms the connection, use the vault ID to check the policy or file a claim after a recorded loss.
          <div className="demo-command">
            <code>bun scripts/agent.ts status {target}</code>
            <code>bun scripts/agent.ts submit-claim {target} .agsurance-agent.key</code>
          </div>
        </li>
      </ol>
      <a className="demo-proof" href="https://github.com/AgSurance/agsurance-fe#run-the-testnet-demo">Open the CLI setup instructions</a>
    </section>
  );
}
