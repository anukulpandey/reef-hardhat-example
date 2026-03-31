const {
  formatTokenAmount,
  getProvider,
  getTokenMetadata,
  getToken,
  parseTokenAmount,
  readAddressArg,
  requireWallet,
} = require("./lib/reef_erc20");

async function main() {
  const provider = getProvider();
  const wallet = requireWallet(provider);
  const token = getToken(wallet);
  const from = readAddressArg("--from", "FROM");
  const to = readAddressArg("--to", "TO");

  if (!from) {
    throw new Error("Missing sender. Pass --from or set FROM.");
  }

  if (!to) {
    throw new Error("Missing recipient. Pass --to or set TO.");
  }

  const { rawAmount, decimals, value } = await parseTokenAmount(token, "--amount", "AMOUNT");

  console.log(`Spender: ${wallet.address}`);
  console.log(`From: ${from}`);
  console.log(`To: ${to}`);
  console.log(`Amount: ${rawAmount}`);

  const tx = await token.transferFrom(from, to, value);
  console.log(`transferFrom tx: ${tx.hash}`);

  const receipt = await tx.wait();
  const [metadata, remainingAllowance, fromBalance, toBalance] = await Promise.all([
    getTokenMetadata(token),
    token.allowance(from, wallet.address),
    token.balanceOf(from),
    token.balanceOf(to),
  ]);

  console.log(`Mined in block: ${receipt.blockNumber}`);
  console.log(`Remaining allowance: ${formatTokenAmount(remainingAllowance, decimals)} ${metadata.symbol}`);
  console.log(`From balance: ${formatTokenAmount(fromBalance, decimals)} ${metadata.symbol}`);
  console.log(`To balance: ${formatTokenAmount(toBalance, decimals)} ${metadata.symbol}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
