export const reserveReplayUrl = "https://agsurance.github.io/agsurance-fe/";
export const cliPayoutHash = "Cosun7xKLxeXHMBuqmFecKcFonuGEvFr4Ff8Wdv28bBU";

export const cliReceipts = {
  declined: "FkB8zVFCydDbMhukMQeB6FHBUDb7xGU2qKhrKcZWzyCz",
  payment: "9MmWAmKmQWoTUAt9SC4mHbgvsZye4RtMZG5CZz4XDbsx",
  claim: "FDhbHXvusRjuPNn4X2d7xcZkhZjAuUQjDvVd1N6bxWji",
};
export const historicalPayoutHash = "7bNezR6hT22Bm2MCeSPc59BC2ehBaYSExTQdqn98MRYP";

export function receiptUrl(hash: string) {
  return `https://testnet.nearblocks.io/txns/${hash}/receipts`;
}
