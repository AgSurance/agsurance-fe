# AgSurance frontend

Next.js App Router, TypeScript, and Tailwind CSS.

```sh
bun install --frozen-lockfile
bun run dev
```

Open http://localhost:3000.

```sh
bun run lint
bun run build
```

The landing page describes the product. `/demo` opens the Agent Console and live coverage dashboard.

## Run the testnet demo

Build the three Rust contracts in `agsurance-sc`, then from this repo:

```sh
bun install --frozen-lockfile
bun scripts/setup-testnet.ts ../agsurance-sc/target/wasm32-unknown-unknown/release
bun run dev --hostname 127.0.0.1
```

Open `http://127.0.0.1:3000/demo`. The setup script creates funded testnet accounts and writes their demo signing configuration to the ignored `.env.local` file. Keep this file local. The signing route is for the loopback demo only. Setup can resume with the same file after a partial failure.

To use an external owner wallet, set `AGSURANCE_POLICY_OWNER` to a funded named testnet account before first setup. Connect that wallet through NEAR Connect in the dashboard. With the generated owner account, **Buy demo policy** and **Connect Agent** use the local demo signer.

1. Select **Fund wallet and buy policy**. Choose a supplier and spending cap of up to 0.05 NEAR. The owner approves 0.36 testnet NEAR plus network fees in one transaction. The vault records the policy mandate and forwards 0.35 NEAR to the agent wallet and keeps the 0.01 NEAR premium. The shared reserve locks 0.40 NEAR before wallet funding. The policy activates after funding succeeds. If capacity is unavailable or funding fails, checkout refunds the full attached amount. The dashboard offers a retry if the refund itself fails.
2. From the agent runtime, run `bun scripts/agent.ts init .agsurance-agent.key`. Paste only the printed public key into **Connect Agent**. The owner funds the agent subaccount with 0.1 testnet NEAR. Keep the key file in the agent runtime.
3. Run the following from the agent runtime with the vault and approved supplier IDs shown on the page. Pay the supplier before recording the simulated loss, then submit the claim:

   ```sh
   bun scripts/agent.ts status <vault.testnet>
   bun scripts/agent.ts pay <vault.testnet> .agsurance-agent.key <supplier.testnet> 0.05
   bun scripts/agent.ts submit-claim <vault.testnet> .agsurance-agent.key
   ```

4. Reopen or refresh the dashboard. Verify the final simulated loss transaction in **Claim review**. Each reviewer checks the actual transfer receipt against the historical mandate and attests to the same receipt. Record two approvals and select **Pay claim**. The shared reserve sends 0.25 NEAR after the deductible. **Verify final payout receipt** opens the transaction receipts in NearBlocks.

The CLI reads and signs directly against NEAR testnet RPC. The owner can revoke the policy's agent grant, which denies new submissions from the old key. The demo review accounts and the loss fixture are provided by the local console. The dashboard stores its confirmed payout link by vault and policy in the ignored `.agsurance-demo` directory. Provision fresh testnet contracts to use the shared reserve. Wallet, vault, and pool accounts are deployed without access keys. Their state is incompatible with the previous demo deployment.

### Renew and recover

The owner buys period 1 at checkout. A connected agent can schedule `bun scripts/agent.ts renew <vault.testnet> <key-file>` in its own runtime (for example, once every 5 minutes). The command skips when there is no premium due. The wallet pays 0.01 NEAR once per period. A late payment resumes coverage from confirmation and keeps the same policy limit. A period that has already ended cannot be backdated. The demo charges the full premium for a late payment.

There are four 7-day periods by default. Set `AGSURANCE_TEST_WINDOW_SECONDS=90` before fresh setup for a shorter testnet demo. The dashboard shows the deadline and pauses supplier payments if coverage lapses. If the wallet needs funds, call its payable `top_up` method with the amount to add and rerun renewal. Plain account transfers are outside the tracked operating balance.

For recovery, use **Stop agent access** and then **Recover wallet balance** as the registered recovery account. That account can also sign the same calls directly on NEAR, using `pause_wallet` and `recover_wallet` with `{"policy_id":1}` (use the actual ID). The first call revokes the agent grant immediately. Wait for any previously scheduled funds transfer to settle before retrying recovery. The second moves the remaining operating balance to the registered recovery account and retires the wallet. Claim reimbursement is a separate transfer from the shared reserve. If loss was recorded before retirement during paid coverage, use **File claim from recovery account**. If a future period was prepaid, use **Refund unused premium**.

### Shared reserve and claim escalation

The dashboard shows assets, allocations across policies, available capacity, and pending payouts. Each registered vault still manages one wallet and one active policy. Multiple vaults can use the same pool by passing its account ID at initialization and having the testnet operator register each vault and its fixed payout destination.

A failed transfer retains the approved claim and its allocation. Retry through **Pay claim** or **Check or retry payout**. When demo collateral is impaired, the dashboard shows the shortfall and pauses new policies and payouts until the pool is fully backed again. Claims can still be filed and reviewed.

**Record escalation** becomes available after 72 hours without quorum. Set `AGSURANCE_TEST_REVIEW_SECONDS=15` before fresh deployment to shorten the review clock. Escalation records a timestamp and preserves the claim and allocation for the panel.

The process cards adapt [React Bits SpotlightCard](https://github.com/DavidHDev/react-bits/blob/c83b5e7e026f003af33ff9ebc3d93afb5c86ad22/src/ts-tailwind/Components/SpotlightCard/SpotlightCard.tsx). See [the upstream license](licenses/react-bits.md).

The hero illustration at `public/account-reserve.jpg` was generated with the built-in image tool. Prompt:

> Create an original premium conceptual 3D editorial still for AgSurance, a NEAR transaction account with coverage for AI agents. Rectangular landscape image 4:3 or 3:2. The concept is a limited execution account and a distinct locked coverage reserve. At center, two architectural objects on a seamless cobalt-blue studio backdrop: on the upper left, a hovering semi-transparent cobalt rectangular plate with precisely machined edges; on the lower right, a heavier closed deep-blue rectangular vault block with an inset pale white panel. A fine bubblegum pink transaction trace travels across the top plate, bends crisply around one edge, and ends at the separately held reserve in a small lit square. Give the two objects a clearly legible physical separation. Soft white edge highlights, brushed resin, subtly refracted blue glass, careful architectural lighting, clear silhouettes, minimalist product photography with an oblique three-quarter isometric view. Large shapes and soft shadows. The dominant blue must be visibly saturated #09318d, with #fd91cc as a small purposeful accent and #ffffff as highlights. No humans, no terrain, no rays or spotlight columns, no circular ring, no icons, no text, no logo, no HUD, no charts, no writing.
