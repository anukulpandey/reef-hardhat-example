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
  const spender = readAddressArg("--spender", "SPENDER");

  if (!spender) {
    throw new Error("Missing spender. Pass --spender or set SPENDER.");
  }

  const { rawAmount, decimals, value } = await parseTokenAmount(token, "--amount", "AMOUNT");

  console.log(`Owner: ${wallet.address}`);
  console.log(`Spender: ${spender}`);
  console.log(`Amount: ${rawAmount}`);

  const tx = await token.approve(spender, value);
  console.log(`Approve tx: ${tx.hash}`);

  const receipt = await tx.wait();
  const [metadata, allowance] = await Promise.all([
    getTokenMetadata(token),
    token.allowance(wallet.address, spender),
  ]);

  console.log(`Mined in block: ${receipt.blockNumber}`);
  console.log(`Allowance: ${formatTokenAmount(allowance, decimals)} ${metadata.symbol}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
