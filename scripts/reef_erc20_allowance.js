const {
  formatTokenAmount,
  getProvider,
  getTokenMetadata,
  getToken,
  maybeGetWallet,
  readAddressArg,
} = require("./lib/reef_erc20");

async function main() {
  const provider = getProvider();
  const wallet = maybeGetWallet(provider);
  const token = getToken(provider);
  const owner = readAddressArg("--owner", "OWNER") || wallet?.address;
  const spender = readAddressArg("--spender", "SPENDER");

  if (!owner) {
    throw new Error("Missing owner. Pass --owner or set OWNER.");
  }

  if (!spender) {
    throw new Error("Missing spender. Pass --spender or set SPENDER.");
  }

  const [metadata, allowance] = await Promise.all([
    getTokenMetadata(token),
    token.allowance(owner, spender),
  ]);

  console.log(`Owner: ${owner}`);
  console.log(`Spender: ${spender}`);
  console.log(`Allowance: ${formatTokenAmount(allowance, metadata.decimals)} ${metadata.symbol}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
