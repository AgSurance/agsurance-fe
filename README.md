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

The landing page describes the proposed account and shows an illustrative claim. It does not connect to a wallet or submit transactions.

The process cards adapt [React Bits SpotlightCard](https://github.com/DavidHDev/react-bits/blob/c83b5e7e026f003af33ff9ebc3d93afb5c86ad22/src/ts-tailwind/Components/SpotlightCard/SpotlightCard.tsx). See [the upstream license](licenses/react-bits.md).

The hero illustration at `public/account-reserve.jpg` was generated with the built-in image tool. Prompt:

> Create an original premium conceptual 3D editorial still for AgSurance, a NEAR transaction account with coverage for AI agents. Rectangular landscape image 4:3 or 3:2. The concept is a limited execution account and a distinct locked coverage reserve. At center, two architectural objects on a seamless cobalt-blue studio backdrop: on the upper left, a hovering semi-transparent cobalt rectangular plate with precisely machined edges; on the lower right, a heavier closed deep-blue rectangular vault block with an inset pale white panel. A fine bubblegum pink transaction trace travels across the top plate, bends crisply around one edge, and ends at the separately held reserve in a small lit square. Give the two objects a clearly legible physical separation. Soft white edge highlights, brushed resin, subtly refracted blue glass, careful architectural lighting, clear silhouettes, minimalist product photography with an oblique three-quarter isometric view. Large shapes and soft shadows. The dominant blue must be visibly saturated #09318d, with #fd91cc as a small purposeful accent and #ffffff as highlights. No humans, no terrain, no rays or spotlight columns, no circular ring, no icons, no text, no logo, no HUD, no charts, no writing.
