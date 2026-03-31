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
  const to = readAddressArg("--to", "TO");

  if (!to) {
    throw new Error("Missing recipient. Pass --to or set TO.");
  }

  const { rawAmount, decimals, value } = await parseTokenAmount(token, "--amount", "AMOUNT");

  console.log(`Sender: ${wallet.address}`);
  console.log(`Recipient: ${to}`);
  console.log(`Amount: ${rawAmount}`);

  const tx = await token.transfer(to, value);
  console.log(`Transfer tx: ${tx.hash}`);

  const receipt = await tx.wait();
  const [metadata, senderBalance, recipientBalance] = await Promise.all([
    getTokenMetadata(token),
    token.balanceOf(wallet.address),
    token.balanceOf(to),
  ]);

  console.log(`Mined in block: ${receipt.blockNumber}`);
  console.log(`Sender balance: ${formatTokenAmount(senderBalance, decimals)} ${metadata.symbol}`);
  console.log(`Recipient balance: ${formatTokenAmount(recipientBalance, decimals)} ${metadata.symbol}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
