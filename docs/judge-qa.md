# AgSurance judge Q&A

AgSurance covers eligible losses from AI agent wallets on NEAR testnet. The demo uses simulated losses and shows the transfers and payouts on testnet.

## Who funds the payouts?

The reserve is a pool of NEAR that pays approved claims. Capital providers add NEAR to the shared reserve and bear losses when it pays claims. A sponsor funded the reserve for the separate 0.25 NEAR replay. The reserve sends each payout to the recovery account that the owner registered. [Capital deposit](https://testnet.nearblocks.io/txns/81QPfbkG2uhDAKc5HL4NhUCqMJijAd1wkHqdfoGQQ49U/receipts)

## What losses does a policy cover?

A policy covers eligible transfers from the registered wallet that break a spending rule while paid coverage is active. A transfer can break a rule if it sends funds to an unapproved recipient or exceeds the spending limit. A blocked payment leaves the funds in the wallet. The owner bears the deductible, the part of the covered loss that the payout excludes. The payout stays within the policy limit. [0.25 NEAR replay](https://agsurance.vercel.app/demo#cli-run)

## How do reviewers use the receipt?

A receipt is the record of a transfer on NEAR. The reviewer tool reads the final receipt through NEAR RPC, an interface for reading NEAR data. Each reviewer makes sure that the transfer succeeded and that the wallet, recipient, amount, and block match the claim. The policy rules at that block determine if the transfer qualifies. The contract requires two of three reviewers to record matching votes on the same receipt. [Claim review](https://github.com/AgSurance/agsurance-sc#review-a-claim-and-pay-it)

## Why did the second payout stay at 0.18 NEAR?

The 0.30 NEAR loss occurred in block 277,218,273, when the limit was 0.18 NEAR. The 0.42 NEAR limit took effect in block 277,218,293. The agent filed the claim after the increase. The contract uses the limit from the block when the loss occurred. The 0.05 NEAR deductible reduced the amount eligible for payout to 0.25 NEAR. The old limit capped the payout at 0.18 NEAR. [Testnet timeline](https://agsurance.vercel.app/demo#historical-limit)

## What is an example of a rejected claim?

NEAR Sandbox is a local NEAR test network. In this test, a simulated transfer of 0.30 NEAR occurred after paid coverage ended. Two reviewers voted to reject the claim. The contract blocked the payout, and the reserve still held 1.00 NEAR. [Run the Sandbox test](https://github.com/AgSurance/agsurance-fe#verify-locally)

## How can I verify the two payouts?

Clone the AgSurance frontend repository. With Bun installed, run `bun run verify:receipts` from the repository root. The command prints `PASS` for each successful check. [Frontend repository](https://github.com/AgSurance/agsurance-fe) · [Testnet receipts](https://agsurance.vercel.app/demo#verify-receipts)
