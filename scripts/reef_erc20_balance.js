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
  const holder = readAddressArg("--address", "TARGET_ADDRESS") || wallet?.address;

  if (!holder) {
    throw new Error("Missing holder address. Pass --address or set TARGET_ADDRESS.");
  }

  const [metadata, balance] = await Promise.all([
    getTokenMetadata(token),
    token.balanceOf(holder),
  ]);

  console.log(`Holder: ${holder}`);
  console.log(`Balance: ${formatTokenAmount(balance, metadata.decimals)} ${metadata.symbol}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
