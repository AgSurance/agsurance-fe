# AgSurance

AgSurance gives AI agents a payment account with loss coverage on NEAR testnet. The owner chooses a supplier and sets a spending limit. The agent can pay that supplier from its own runtime. If the demo records a loss, reviewers examine the transfer before a separate reserve pays the claim.

[Open the live demo](https://agsurance.vercel.app/demo) · [Connect Wallet on testnet](https://agsurance.vercel.app/demo#manual-demo) · [Open the 0.25 NEAR CLI replay](https://agsurance.vercel.app/demo#cli-run) · [Inspect the 0.18 NEAR historical payout](https://agsurance.vercel.app/demo#historical-limit) · [Run the verification](#verify-locally) · [Read the Rust contracts](https://github.com/AgSurance/agsurance-sc)

## Verify the 0.25 NEAR CLI replay

Follow one CLI run through a blocked payment, an approved supplier payment, and reimbursement for a separate simulated loss. Open the public receipts without a wallet or invite code. The claim ID is `vault.agsurance-7910a4d8.testnet/1`.

| Action | Result | Evidence |
| --- | --- | --- |
| Buy coverage and connect the agent | The owner sets the supplier and a 0.05 NEAR spending limit, then grants the agent access. | [Checkout](https://testnet.nearblocks.io/txns/9z5JCov2sVrZYE3gN9nyE4vBmtHe9KZYiwAZVGzH62pw/receipts) · [Agent grant](https://testnet.nearblocks.io/txns/32tQ1gya41MBpNtBWKn6HvPErxp6Acdg9aLMARmauteb/receipts) |
| Request a payment outside the mandate | The agent requests 0.01 NEAR to the recovery account. The wallet call fails and sends no funds. | [Rejected payment](https://testnet.nearblocks.io/txns/FkB8zVFCydDbMhukMQeB6FHBUDb7xGU2qKhrKcZWzyCz/receipts) |
| Pay the approved supplier | The same CLI agent sends 0.05 NEAR to the supplier in the mandate. | [Supplier payment](https://testnet.nearblocks.io/txns/9MmWAmKmQWoTUAt9SC4mHbgvsZye4RtMZG5CZz4XDbsx/receipts) |
| Record a simulated loss | The demo runner sends 0.30 NEAR to a separate test incident account. | [Simulated loss](https://testnet.nearblocks.io/txns/4xLhrcrh6uBeQzqF3YdYiamGR4ysBw2GcQRxVwFpuxa5/receipts) |
| File the claim and approve it | The agent files from the CLI. Two reviewer accounts approve the same final loss receipt. | [CLI claim](https://testnet.nearblocks.io/txns/FDhbHXvusRjuPNn4X2d7xcZkhZjAuUQjDvVd1N6bxWji/receipts) · [Reviewer 1](https://testnet.nearblocks.io/txns/4QQF7JEdqGjDnyySY3co9RKZLMD3bVA8SwhskPz8RD3X/receipts) · [Reviewer 2](https://testnet.nearblocks.io/txns/8m4Yg68qLei14rVzwwhYEhJ8aSLFyov2E3A7u3Wdp8NH/receipts) |
| Pay the claim | The reserve transfers **0.25 NEAR** to the registered recovery account after the 0.05 NEAR deductible. | [Final payout](https://testnet.nearblocks.io/txns/Cosun7xKLxeXHMBuqmFecKcFonuGEvFr4Ff8Wdv28bBU/receipts) |

Compare the approved supplier `supplier.agsurance-7910a4d8.testnet` with the simulated loss recipient `incident.agsurance-7910a4d8.testnet`. The payout goes to `recovery.agsurance-7910a4d8.testnet`.

## Verify the 0.18 NEAR historical payout

This is a separate NEAR testnet run on policy `v-1cba0c6bad2c3e0cea5b.f.agmaker-dd6ef8.testnet/1`. A [capital deposit](https://testnet.nearblocks.io/txns/81QPfbkG2uhDAKc5HL4NhUCqMJijAd1wkHqdfoGQQ49U/receipts) opened capacity for a previously blocked checkout.

[Open the timeline in the demo](https://agsurance.vercel.app/demo#historical-limit)

| Step | What to check | Evidence |
| --- | --- | --- |
| Record a simulated loss | The 0.30 NEAR transfer executed in block **277,218,273** while the payout limit was **0.18 NEAR**. | [Original checkout](https://testnet.nearblocks.io/txns/8fTSvqtdGgnu8oSRwoVD9VvESmmonPuQ8PAqz64ZHEco/receipts) · [Loss receipt](https://testnet.nearblocks.io/txns/BymqcFtbnvv1By82NaRvmUegQsc9p5DdZDdtB4z8jDAJ/receipts) · [Loss block](https://testnet.nearblocks.io/blocks/277218273) |
| Raise the limit | The vault confirmed **0.42 NEAR** in block **277,218,292**. The contract applies the increase starting at the next block, **277,218,293**. | [Increase receipts](https://testnet.nearblocks.io/txns/CL3ko61db2p4Mw2tZaLEaj9hPWLaXZpW3tipt7CyrkNV/receipts) · [Confirmation callback](https://testnet.nearblocks.io/txns/CL3ko61db2p4Mw2tZaLEaj9hPWLaXZpW3tipt7CyrkNV/execution#2muG7K5oEDzrQ9SuJSCUj9Kh2RjH7tP2yemzG2tUHpsw) · [Effective block](https://testnet.nearblocks.io/blocks/277218293) |
| File and settle the claim | The agent filed after the increase. Both reviewers voted on the earlier loss, and the reserve paid **0.18 NEAR**. | [Claim](https://testnet.nearblocks.io/txns/J4nvLf47vmy5rfwf2aB1nU2TYXeQ68cK5d5qEGyuqeD6/receipts) · [Reviewer 1](https://testnet.nearblocks.io/txns/AixCayE4YVQJmZHGyg66rgNLEf65574qabX2bYZE8HrK/receipts) · [Reviewer 2](https://testnet.nearblocks.io/txns/8X9joNTVEjpzZs5Vnc3XNb4g7umoEKPBFmu3gPeQGs5t/receipts) · [Payout receipt](https://testnet.nearblocks.io/txns/7bNezR6hT22Bm2MCeSPc59BC2ehBaYSExTQdqn98MRYP/receipts) |

## Verify locally

Install Bun 1.3.10 and Rust 1.96 via rustup. Clone the [contract repo at the revision used by CI](https://github.com/AgSurance/agsurance-sc/tree/f366a2cea2383e2142b4f86b92cf833f3d086c5f) beside this repo as `agsurance-sc`, or set `AGSURANCE_SC_DIR` to its location. From this repo run:

```sh
bun run verify:judge
```

The command installs the locked dependencies, builds four contracts and runs the scenario in a local NEAR Sandbox without wallet credentials or testnet transactions. It prints a result for the checkout rejected at insufficient capacity, a deposit that opens capacity, and the payout limited by the earlier policy terms. [GitHub Actions workflow](.github/workflows/verify-judge.yml)

The same test verifies a **rejected claim**. A 0.30 NEAR simulated transfer executes after the paid coverage window ends. Two reviewers reject the claim, the vault refuses the payout, and the test checks that reserve assets are still **1.00 NEAR**. [Reproduce the rejected claim](scripts/test-rolling-capacity.ts)

NEAR Sandbox downloads its binary on first use. If you already have the official 2.13.3 binary, set `NEAR_SANDBOX_BIN_PATH` to its absolute path.

## Use your own testnet wallet

Open the [wallet section of the demo](https://agsurance.vercel.app/demo#manual-demo), select **Connect Wallet**, and choose **Buy a policy** or **Provide capital**. Use a funded named testnet wallet to buy a policy. The buyer pays a one-time account storage deposit, then signs the checkout from their wallet. The dashboard displays the exact NEAR funding, premium, payout limit and deductible from the deployed vault. It also shows the agent setup commands after purchase.

Follow the local setup below to run the CLI with your own agent.

The public judge Preview uses the shared testnet reserve described in the [historical payout run](#verify-the-018-near-historical-payout).

The landing page shows illustrative 28-day premium scenarios with zero deductible. Checkout shows the terms enforced by the selected vault.

Set `AGSURANCE_MANUAL_FACTORY`, `AGSURANCE_MANUAL_CAPITAL_POOL`, and `AGSURANCE_MANUAL_SUPPLIER` to the public testnet accounts to enable the signed actions in a local deployment. [Factory setup](https://github.com/AgSurance/agsurance-sc#manual-demo-factory) · [Testnet faucet](https://near-faucet.io/)

For a fresh shared-reserve deployment, set `AGSURANCE_MANUAL_FACTORY` to the factory configured with a risk group. The frontend discovers the reserve and group from the factory. `AGSURANCE_MANUAL_CAPITAL_POOL` is the fallback for older factories with a separate pilot.

- **Buy coverage:** Enter the funds you want to add and choose a payout limit. The maximum quote uses the wallet balance after the deductible, free liquid capital, the per-policy cap, and the remaining risk-group cap. The reserve rechecks capacity at checkout.
- **Increase an active limit:** Top up the wallet if needed, then approve the premium difference for the current and any already-paid future weeks. The increase takes effect prospectively. The original limit still applies to earlier losses.
- **Provide capital:** A confirmed deposit in the shared reserve can open more checkout capacity. Providers receive shares at the pool's current value and take on existing obligations. The dashboard shows capital allocated to claims, the buffer, and surplus available for staking. Deposits pause while a payout is in flight or validator funds are being reconciled.

## How the demo works

A policy records the supplier, spending limit, and coverage terms. A premium is the price of a period of coverage. The reserve holds funds for claims. A receipt records the result of a transaction on NEAR.

```mermaid
flowchart TD
    Operator[Operator] -->|Sets up the demo| Owner[Owner]
    Sponsor[Reserve sponsor] -->|Funds| Pool[Reserve pool]
    Owner -->|Funds the wallet and buys coverage| Vault[Coverage vault]
    Vault -->|Books capacity| Pool
    Owner -->|Grants access| Agent[Agent]
    Agent -->|Requests supplier payment| Vault
    Vault -->|Funds wallet and forwards payment requests| Wallet[Agent wallet]
    Wallet -->|Pays| Supplier[Approved supplier]
    Agent -->|Files the claim| Vault
    Reviewers[Reviewers] -->|Two matching approvals| Vault
    Vault -->|Requests payout| Pool
    Pool -->|Pays the claim| Recovery[Recovery account]
    Recovery -->|Can pause, replace the agent, or start retirement| Vault
    Wallet -->|Returns the remaining balance on retirement| Recovery
```

The operator sets up the demo accounts. A sponsor funds the reserve. The reviewers record their votes through the vault. The registered recovery account receives the payout. It can also stop the agent, authorize a replacement, or recover the remaining wallet balance through a separate action.

## How AgSurance uses NEAR

| NEAR feature | What it does in AgSurance |
| --- | --- |
| Function-call access keys | A function-call key can call specific methods. The agent uses one to request supplier payments, renew coverage, and file claims. |
| Named accounts | The demo uses separate accounts for the agent, wallet, vault, reserve, and reviewers. |
| Rust contracts | The vault opens policies and records votes. The wallet enforces spending rules. The reserve sets aside funds and pays claims. |
| Calls between contracts | The vault reserves funds before it funds the wallet. The vault activates coverage after the wallet confirms funding. |
| NEAR RPC and receipts | NEAR RPC lets the reviewer client read transaction results. The client reads the transfer receipt. The vault requires matching votes on that receipt. |
| NEAR Connect | The owner can sign with a funded testnet wallet in the local console. |

The spending controls and the ability to revoke access fit the AI Security & Defense track. Supplier payments and renewals from the agent runtime fit the Agent Economy track.

## Run the testnet demo

Install Bun and the Rust toolchain. If you plan to use your own funded testnet wallet, set `AGSURANCE_POLICY_OWNER` before setup. Use a named `.testnet` account.

Run these commands in a fresh directory. The setup script deploys fresh contracts to NEAR testnet and writes the local signing configuration to `.env.local`. Keep that file private. Use it to resume the same setup after a partial failure.

```sh
git clone https://github.com/AgSurance/agsurance-sc.git
git clone https://github.com/AgSurance/agsurance-fe.git
cd agsurance-sc
rustup target add wasm32-unknown-unknown
cargo build --locked --release --target wasm32-unknown-unknown
cd ../agsurance-fe
bun install --frozen-lockfile
bun scripts/setup-testnet.ts ../agsurance-sc/target/wasm32-unknown-unknown/release
bun run dev --hostname 127.0.0.1
```

Open [the local console](http://127.0.0.1:3000/demo). If you set `AGSURANCE_POLICY_OWNER`, connect that wallet through NEAR Connect. Otherwise, the console uses the generated demo signer. The local signing route accepts requests from the loopback console.

1. Select `Fund wallet and buy policy`. Choose the demo supplier and set the limit to 0.05 NEAR. Wait until the policy is active. If capacity is unavailable or funding fails, the vault refunds checkout. The dashboard offers a retry if the refund fails.
2. Run the following command from `agsurance-fe`. Paste the public key into `Connect Agent`. Keep the private key file in the agent runtime. Wait for the console to show that the agent is connected.

   ```sh
   bun scripts/agent.ts init .agsurance-agent.key
   ```

3. Use the vault, recovery account, and supplier IDs from the dashboard. Run both payment requests from the agent runtime. The wallet rejects the first request and pays the approved supplier on the second.

   ```sh
   bun scripts/agent.ts status <vault.testnet>
   bun scripts/agent.ts pay <vault.testnet> .agsurance-agent.key <recovery.testnet> 0.01
   bun scripts/agent.ts pay <vault.testnet> .agsurance-agent.key <supplier.testnet> 0.05
   ```

4. Select `Simulate 0.3 NEAR loss` in the console. Wait until the loss appears in the transaction trail. Submit the claim from the agent runtime.

   ```sh
   bun scripts/agent.ts submit-claim <vault.testnet> .agsurance-agent.key
   ```

5. Open `Claim review`. Select `Verify loss receipt`. Approve the claim as reviewer 1. Approve it as reviewer 2.
6. Select **Pay claim**. Open **Verify final payout receipt** after the transfer completes.
7. To try the recovery variant, use a separate run. In **Recovered claim funds**, attach 0.05 NEAR from the registered recovery account while the claim is in review or approved, before starting payout. Select **Send recovered funds**, then **Pay claim** after approval. The reserve pays 0.20 NEAR. Distribute the recorded 0.05 NEAR separately to the recovery account.

The console stores confirmed payout links by vault and policy in `.agsurance-demo`. The agent keeps its private key in its own runtime. The wallet, vault, and pool contracts are deployed without account access keys.

### What to look for

| Action | Expected result | Where to look |
| --- | --- | --- |
| Buy the policy | The wallet receives 0.35 NEAR. The reserve sets aside 0.40 NEAR. | Policy status and reserve balances |
| Pay outside the mandate | The wallet rejects the request and sends no funds. | Agent command output and the failed NEAR receipt |
| Pay the supplier | The approved supplier receives 0.05 NEAR. | Agent command output and NEAR testnet receipt |
| Simulate the loss | A test transfer of 0.30 NEAR appears. | Transaction trail and loss receipt |
| Review the claim | Two reviewer accounts approve the same receipt. | Claim review |
| Pay the claim | The recovery account receives 0.25 NEAR. | [Example payout receipt](https://testnet.nearblocks.io/txns/Cosun7xKLxeXHMBuqmFecKcFonuGEvFr4Ff8Wdv28bBU/receipts) or the receipt from your run |

The [shared-reserve replay](https://agsurance.github.io/agsurance-fe/) covers a separate scenario with two policies, a capacity refund, and a payout retry.

## Check the frontend

The frontend uses Next.js App Router, TypeScript, and Tailwind CSS. Run these checks from `agsurance-fe`.

```sh
bun run lint
bun run build
```

## Business model and reserve economics

The first customers are teams that give agents a budget for recurring payments. Examples include payments for APIs, computing, and other digital services. The team pays for coverage when it funds the wallet. The agent can pay later premiums from the wallet balance.

The fixed-term local replay uses NEAR for the wallet balance, premiums, reserve, and payout. The initial payment is 0.36 NEAR before network fees. Of that amount, 0.35 NEAR funds the wallet and 0.01 NEAR pays the first premium. The owner also funds the agent subaccount with 0.10 NEAR when they connect the agent.

The reserve sponsor supplies the capital for payouts. The pool sets aside 0.40 NEAR for the demo policy. The deductible is the part of a covered loss that the owner pays. The 0.30 NEAR loss minus the 0.05 NEAR deductible gives a 0.25 NEAR payout.

The optional capital pilot credits earned premiums to the operator and capital providers. Capital providers bear losses from paid claims and receive their share of any staking rewards after the funds return to the reserve. The pilot also supports cashback for a fully paid term without a coverage gap. The public wallet checkout uses the shared reserve. The invite console and recorded replay use their own testnet setups.

## Demo scope

The local console and agent run on NEAR testnet. The loss comes from a test function. Two of three reviewer accounts must approve the same receipt before the vault can request payment. The public replay shows a recorded run. The hosted console signs new transactions with accounts prepared for each invite. A fresh local deployment enables the latest contract and CLI features.

## Renew coverage and recover the wallet balance

The demo uses four periods of seven days by default. Each renewal costs 0.01 NEAR. The dashboard and CLI report when payment opens, the due time, and known blockers. Run this command from `agsurance-fe` with the vault account and the agent key file. It skips when no premium is due.

```sh
bun scripts/agent.ts renew <vault.testnet> .agsurance-agent.key
```

A late premium resumes coverage from confirmation and keeps the same policy limit. Supplier payments pause while coverage has lapsed. If the operating balance is low, attach funds through the wallet's payable `top_up` method. To shorten a fresh test run, set `AGSURANCE_TEST_WINDOW_SECONDS=90` before setup.

If the CLI returns `pending_confirmation`, run `bun scripts/agent.ts reconcile <vault.testnet>` from the same directory. The local console offers **Check transaction**. Both check the original transaction hash before retrying a signed request.

`agent.ts status VAULT` and `GET /api/demo` share a `status` object. It includes policy and checkout IDs, coverage, the filing deadline, renewal, action availability, and pending confirmation. Local API callers send `expectedPolicyId` and, for checkout refunds, `expectedCheckoutId`. Use `null` for the policy ID before the first purchase.

For a compromised agent credential, use the registered recovery account and select **Stop agent access**. Generate a fresh key with `agent.ts init` in the replacement runtime. Enter its public key under **Connect replacement agent** and fund the replacement with 0.10 NEAR. Select **Resume wallet** after the new grant is confirmed and any pending premium has settled.

To retire the wallet, wait for pending transfers to finish and select **Move balance and retire wallet**. Starting the balance transfer disables resumption. The recovery account can retry a failed transfer, file a claim for a covered loss before retirement, and request **Refund unused premium** for a prepaid period that had yet to begin.

### Shared reserve and claim escalation

The dashboard shows the reserve's assets, allocations, available capacity, and pending payouts. Each registered vault manages one wallet and one active policy. Several vaults can use the same pool with fixed payout destinations.

The filing window ends 48 hours after the policy ends or the wallet retires early. Select **Close policy and release reserve** after the window closes. An open claim retains its allocation. **Record escalation** becomes available after 72 hours without quorum and keeps the claim with the same panel. Set `AGSURANCE_TEST_REVIEW_SECONDS=15` before provisioning a fresh demo to shorten the review clock.

A failed transfer retains the approved claim and its allocation. Retry through **Pay claim** or **Check or retry payout**. A collateral shortfall pauses new policies and payouts while claim filing and review remain available.

### Claims from observed NEAR transfers

New testnet vaults pin the wallet code at setup. In the local console, select **Scan recent transfers**, or enter a finalized transaction hash and its signer. The scan uses NearBlocks to find recent candidate transactions. NEAR RPC checks the successful transfer, source wallet, recipient, amount, policy window, and wallet code at execution. An observed bundle can contain up to eight transfer actions. The current checks flag a different recipient or an individual amount over the spending limit.

```sh
bun scripts/agent.ts watch <vault.testnet>
bun scripts/agent.ts submit-observed <vault.testnet> .agsurance-agent.key references.json
```

The reference file is a JSON array of objects with `transactionHash` and `signerId`. The agent needs an active grant to file. The reviewer console checks the bundle against final NEAR receipts before each reviewer votes. Two matching votes are required to approve it.

Before checkout, the owner can register a separate recovery account once. After the old wallet is retired, set `AGSURANCE_WASM_DIR` to the directory containing the three compiled contracts, restart the local app, and select **Set up replacement wallet**. The operator needs testnet funds to deploy the new wallet and vault. The new vault reuses the recovery account and reserve. The console links back to the retired wallet and its claims. The current supplier can confirm a new address via `confirm_vendor_change`; checkout on the replacement wallet uses that address only after the owner confirms it.

### Recovered claim funds

The registered recovery account can attach funds recovered from the incident after any external recovery costs. Before payout, the deposit reduces the loss used to calculate the payout. A zero payout settles the claim and releases its reserve allocation.

After payout, the contract credits the recovery account for loss above the limit, then repays the reserve up to the payout, then credits the recovery account for the deductible. Use the distribution buttons to send each credit to its fixed destination. A failed transfer stays available for retry.

### Optional capital pilot

Provision fresh contracts. Set `AGSURANCE_PILOT_VALIDATOR` to an approved staking-pool contract on NEAR testnet. Set `AGSURANCE_PILOT_BUFFER_NEAR` and `AGSURANCE_PILOT_STAKE_CAP_NEAR` for the chosen cohort. Both default to 0.10 NEAR. Run the setup script with the pilot settings each time you provision or resume that environment. Without a validator setting, setup uses the standard demo pool.

1. Capital providers call `fund_capital_pilot` on the reserve with an attached deposit in whole milliNEAR. The operator calls `seal_capital_pilot` once the cohort is funded. Deposits made through `fund_reserve` add collateral without creating a position.
2. The operator can call `delegate_surplus(amount)` up to the cap and the free balance after claims and buffer. Call `request_undelegation`, then `request_validator_withdrawal` after the validator’s waiting period. Call `reconcile_validator_withdrawal` after NEAR reaches the reserve. Use at least 180 Tgas for the withdrawal request. Inspect `capital_status` for the stage, liquid surplus, and available credits. [NEAR staking pool](https://github.com/near/core-contracts/tree/master/staking-pool)
3. After a policy ends and its claim is settled or its allocation released, call `settle_earned_premiums(policy_id)` on the vault. Settle any unused premium refund first. An uninterrupted, fully paid term qualifies for the 20% testnet cashback. The reserve credits 70% of the remaining earned premium to the cohort and the balance to the operator. The owner and operator use `withdraw_pilot_income` to collect their credits.
4. Once all policies and validator transfers are settled, the operator can call `close_capital_pilot`. Each provider calls `claim_capital_pilot` and `withdraw_pilot_income` to collect its share of the remaining collateral, earned premiums, and staking rewards received by the reserve. Capital is at risk until closure. A provider can claim its share of any later recovery that reaches the reserve.

The recovery and cashback flows passed in NEAR Sandbox. A separate testnet pilot delegated 0.05 NEAR to an active validator and started unbonding. Withdrawal and realized staking rewards are pending. [Delegation](https://testnet.nearblocks.io/txns/6xhbspGPdjQAabzeCHiNJ6jrsb2f9MroJKQu397aFmgp/receipts) · [Unstake](https://testnet.nearblocks.io/txns/BqTHkxn8xrebaeqRqvZmMFLQXjrjPaecmYXJBPm9Tvo1/receipts)

## Live regression checks

For a fresh test setup, set `AGSURANCE_TEST_WINDOW_SECONDS=30` and `AGSURANCE_TEST_CLAIM_SECONDS=15` before you run the setup script. Use a demo owner with at least 0.95 NEAR left after setup. Run the test from the directory that holds this setup's `.env.local`.

```sh
AGSURANCE_RUN_LIVE_TESTS=1 bun /path/to/agsurance-fe/scripts/test-state-machines.ts
```

The test sends transactions on NEAR testnet. It takes several minutes. It covers policy expiry, requests for stale policies, an interrupted payment response, and coverage at the time of transfer. When a simulated loss lands inside the paid window, it also checks payout reconciliation and receipt storage.

## Host the demo on Vercel

Import `AgSurance/agsurance-fe` with `main` as the production branch. Use the Next.js preset with the repository root. If you set the commands manually, use `bun install --frozen-lockfile` and `bun run build`. Keep access to system environment variables enabled so the app can read `VERCEL=1`. The public replay is available by default.

For private hosted console sessions, connect Upstash Redis to the Preview environment. Redis stores transaction status and receipts so the console can resume after a refresh. Use `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, or use `KV_REST_API_URL` and `KV_REST_API_TOKEN`.

Prepare a separate testnet setup for each invite. Run this command from `agsurance-fe` to write the invite files to a new private directory.

```sh
bun scripts/prepare-hosted-demo.ts /path/to/private-invites /path/to/slot-a/.env.local /path/to/slot-b/.env.local
```

Set the sensitive Preview variable `AGSURANCE_DEMO_INVITES` to the contents of `accounts.json` and redeploy the app. Keep both output files outside the deployed directory. Keep the local operator's signing configuration and keys on the local machine.

For a recovery Preview, prepare separate invite accounts from a newly deployed testnet vault. Set `AGSURANCE_RECOVERY_PREVIEW=1` in the Vercel Preview environment and configure the invites and Redis for that environment. The invite console can submit observed evidence from the simulated loss and add one 0.05 NEAR recovery before payout. Recovery-account setup and replacement provisioning use the local console.

## Optional duplicate invoice simulation

Run `bun install --frozen-lockfile` and `bun run dev`. In the [local demo](http://localhost:3000/demo#duplicate-invoice), expand **Duplicate invoice simulation (optional)** and select **Run invoice simulation**.

A scripted agent requests two payments of 0.05 NEAR for invoice `INV-1042` to the approved supplier. Both fit within the 0.12 NEAR spending limit, so the 0.05 NEAR overpayment falls outside the current policy, which requires a mandate breach. A proposed invoice ID check blocks the second payment in the comparison. The browser uses a mock ledger to illustrate this coverage boundary.

## Credits

The team used an image generation tool for `public/account-reserve.jpg`.
