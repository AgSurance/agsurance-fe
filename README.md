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

Build the two Rust contracts in `agsurance-sc`, then from this repo:

```sh
bun install --frozen-lockfile
bun scripts/setup-testnet.ts ../agsurance-sc/target/wasm32-unknown-unknown/release
bun run dev --hostname 127.0.0.1
```

Open `http://127.0.0.1:3000/demo`. The setup script creates funded testnet accounts and writes their demo signing configuration to the ignored `.env.local` file. Keep this file local. The signing route is for the loopback demo only. Setup can resume with the same file after a partial failure.

To use an external owner wallet, set `AGSURANCE_POLICY_OWNER` to a funded named testnet account before first setup. Connect that wallet through NEAR Connect in the dashboard. With the generated owner account, **Buy demo policy** and **Connect Agent** use the local demo signer.

1. Select **Fund wallet and buy policy**. Choose a supplier and spending cap of up to 0.05 NEAR. The owner approves 0.36 testnet NEAR plus network fees in one transaction. The vault records the policy mandate and forwards 0.35 NEAR to the agent wallet and keeps the 0.01 NEAR premium. The policy activates and 0.40 NEAR stays reserved after funding succeeds. If funding fails, the vault refunds the full attached amount. The dashboard offers a retry if the refund itself fails.
2. From the agent runtime, run `bun scripts/agent.ts init .agsurance-agent.key`. Paste only the printed public key into **Connect Agent**. The owner funds the agent subaccount with 0.1 testnet NEAR. Keep the key file in the agent runtime.
3. Run the following from the agent runtime with the vault and approved supplier IDs shown on the page. Pay the supplier before recording the simulated loss, then submit the claim:

   ```sh
   bun scripts/agent.ts status <vault.testnet>
   bun scripts/agent.ts pay <vault.testnet> .agsurance-agent.key <supplier.testnet> 0.05
   bun scripts/agent.ts submit-claim <vault.testnet> .agsurance-agent.key
   ```

4. Reopen or refresh the dashboard. Verify the final simulated loss transaction in **Claim review**. Each reviewer checks the actual transfer receipt against the historical mandate and attests to the same receipt. Record two approvals and select **Pay claim**. The vault sends 0.25 NEAR after the deductible. **Verify final payout receipt** opens the transaction receipts in NearBlocks.

The CLI reads and signs directly against NEAR testnet RPC. The owner can revoke the policy's agent grant, which denies new submissions from the old key. The demo review accounts and the loss fixture are provided by the local console. The dashboard stores its confirmed payout link by vault and policy in the ignored `.agsurance-demo` directory. Provision fresh testnet contracts to use supplier mandates and receipt review.

The process cards adapt [React Bits SpotlightCard](https://github.com/DavidHDev/react-bits/blob/c83b5e7e026f003af33ff9ebc3d93afb5c86ad22/src/ts-tailwind/Components/SpotlightCard/SpotlightCard.tsx). See [the upstream license](licenses/react-bits.md).

The hero illustration at `public/account-reserve.jpg` was generated with the built-in image tool. Prompt:

> Create an original premium conceptual 3D editorial still for AgSurance, a NEAR transaction account with coverage for AI agents. Rectangular landscape image 4:3 or 3:2. The concept is a limited execution account and a distinct locked coverage reserve. At center, two architectural objects on a seamless cobalt-blue studio backdrop: on the upper left, a hovering semi-transparent cobalt rectangular plate with precisely machined edges; on the lower right, a heavier closed deep-blue rectangular vault block with an inset pale white panel. A fine bubblegum pink transaction trace travels across the top plate, bends crisply around one edge, and ends at the separately held reserve in a small lit square. Give the two objects a clearly legible physical separation. Soft white edge highlights, brushed resin, subtly refracted blue glass, careful architectural lighting, clear silhouettes, minimalist product photography with an oblique three-quarter isometric view. Large shapes and soft shadows. The dominant blue must be visibly saturated #09318d, with #fd91cc as a small purposeful accent and #ffffff as highlights. No humans, no terrain, no rays or spotlight columns, no circular ring, no icons, no text, no logo, no HUD, no charts, no writing.
