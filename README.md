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

1. Buy a demo policy as the owner. The vault locks 0.4 testnet NEAR of capacity against a 0.01 NEAR premium.
2. Simulate a 0.3 NEAR loss from the wallet fixture and submit the claim as the scripted runner.
3. Record two reviewer approvals and pay the claim. A 0.05 NEAR deductible leaves a 0.25 NEAR payout to the fixed recovery account.

The wallet fixture makes a real testnet transfer and records the incident only after that transfer succeeds. The claims vault checks the record and only marks reimbursement complete after its own transfer succeeds. Reviewer buttons use distinct test accounts in the same local presenter session. Explorer links point to the actual transactions. The current policy lives on-chain and the console's transaction trail is kept in the browser.

The process cards adapt [React Bits SpotlightCard](https://github.com/DavidHDev/react-bits/blob/c83b5e7e026f003af33ff9ebc3d93afb5c86ad22/src/ts-tailwind/Components/SpotlightCard/SpotlightCard.tsx). See [the upstream license](licenses/react-bits.md).

The hero illustration at `public/account-reserve.jpg` was generated with the built-in image tool. Prompt:

> Create an original premium conceptual 3D editorial still for AgSurance, a NEAR transaction account with coverage for AI agents. Rectangular landscape image 4:3 or 3:2. The concept is a limited execution account and a distinct locked coverage reserve. At center, two architectural objects on a seamless cobalt-blue studio backdrop: on the upper left, a hovering semi-transparent cobalt rectangular plate with precisely machined edges; on the lower right, a heavier closed deep-blue rectangular vault block with an inset pale white panel. A fine bubblegum pink transaction trace travels across the top plate, bends crisply around one edge, and ends at the separately held reserve in a small lit square. Give the two objects a clearly legible physical separation. Soft white edge highlights, brushed resin, subtly refracted blue glass, careful architectural lighting, clear silhouettes, minimalist product photography with an oblique three-quarter isometric view. Large shapes and soft shadows. The dominant blue must be visibly saturated #09318d, with #fd91cc as a small purposeful accent and #ffffff as highlights. No humans, no terrain, no rays or spotlight columns, no circular ring, no icons, no text, no logo, no HUD, no charts, no writing.
