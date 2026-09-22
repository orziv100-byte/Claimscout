# Third-party notices

PoolIndex original product, source code, operations, user interface, visual design, and documentation are © 2026 Lior Elbaz, Israel. All rights reserved. That notice does **not** cover third-party software.

This file is an engineering inventory of **direct** runtime and development dependencies, plus flags for notable **transitive production** licenses. Exact versions are in `package-lock.json`. This is not legal advice.

Legend: ATTRIBUTION REQUIRED · COPYLEFT / RECIPROCAL · UNKNOWN LICENSE · NON-STANDARD LICENSE

No UNKNOWN LICENSE found in the production tree at audit time. No GPL/AGPL/MPL copyleft packages found in the production tree. Do not copy this notice into vendor code. Do not delete a dependency solely because of a license flag without an owner decision.

## Direct runtime (distributed with the app)

| Package | Version | License | Source | Copyright/attribution | Notice | License text | Redistribution | Flag |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| next | 16.3.4 | MIT | vercel/next.js | Next.js contributors | Keep MIT notice | MIT text with binaries | MIT | — |
| react | 19.2.8 | MIT | github.com/facebook/react | React authors | Keep MIT notice | MIT | MIT | — |
| react-dom | 19.2.8 | MIT | github.com/facebook/react | React authors | Keep MIT notice | MIT | MIT | — |
| viem | 2.56.3 | MIT | github.com/wevm/viem | wevm | Keep MIT notice | MIT | MIT | — |
| lucide-react | 1.45.0 | ISC | github.com/lucide-icons/lucide | Eric Fennis | Keep ISC notice | ISC | ISC | ATTRIBUTION REQUIRED (ISC notice) |
| class-variance-authority | 0.7.1 | Apache-2.0 | github.com/joe-bell/cva | Joe Bell | NOTICE if provided | Apache-2.0 | Apache-2.0 | ATTRIBUTION REQUIRED |
| @base-ui/react | 1.8.0 | MIT | github.com/mui/base-ui | MUI Team | Keep MIT notice | MIT | MIT | — |
| shadcn | 4.21.0 | MIT | github.com/shadcn-ui/ui | shadcn | Keep MIT notice | MIT | MIT | — |
| tw-animate-css | 1.4.0 | MIT | github.com/Wombosvideo/tw-animate-css | Luca Bosin | Keep MIT notice | MIT | MIT | — |
| cn | 0.2.6 | MIT | github.com/shadcn-ui/cn | — | Keep MIT notice | MIT | MIT | — |

## Direct development-only

| Package | Version | License | Flag |
| --- | --- | --- | --- |
| typescript | 5.9.3 | Apache-2.0 | ATTRIBUTION REQUIRED |
| eslint | 9.39.5 | MIT | — |
| eslint-config-next | 16.3.4 | MIT | — |
| tailwindcss | 4.3.3 | MIT | — |
| @tailwindcss/postcss | 4.3.3 | MIT | — |
| @types/node | 20.19.43 | MIT | — |
| @types/react | 19.3.0 | MIT | — |
| @types/react-dom | 19.3.0 | MIT | — |

## Transitive production tree (summary)

Audited via `package-lock.json` production walk (321 packages): MIT 284, ISC 19, BSD-3-Clause 6, BSD-2-Clause 5, Apache-2.0 4, 0BSD 1, CC-BY-4.0 1, Python-2.0 1. Unknown: 0. Copyleft/reciprocal (GPL/AGPL/LGPL/MPL/SSPL): 0.

| Package | Version | License | Flag |
| --- | --- | --- | --- |
| caniuse-lite | 1.0.30001810 | CC-BY-4.0 | ATTRIBUTION REQUIRED (Creative Commons) |
| argparse | 2.0.1 | Python-2.0 | NON-STANDARD LICENSE |

Fonts: Geist / Geist Mono / Newsreader are loaded from `next/font/google`. Their upstream licenses apply; do not treat them as PoolIndex original type.

External **data** (GitHub search hits, Wayback snapshots, archive.org items, chain explorer pages, catalog descriptions of third-party projects, official Uniswap merkle chunk JSON from `Uniswap/mrkl-drop-data-chunks` MIT) remains third-party content. PoolIndex does not claim copyright over that material. PoolIndex does not vendor `@uniswap/merkle-distributor` (GPL-3.0).
