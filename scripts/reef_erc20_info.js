const { formatEther } = require("ethers");
const {
  formatTokenAmount,
  getContractAddress,
  getProvider,
  getRpcUrl,
  getTokenMetadata,
  getToken,
  maybeGetWallet,
} = require("./lib/reef_erc20");

async function main() {
  const provider = getProvider();
  const wallet = maybeGetWallet(provider);
  const token = getToken(wallet || provider);
  const contractAddress = getContractAddress();
  const network = await provider.getNetwork();

  const [metadata, totalSupply] = await Promise.all([
    getTokenMetadata(token, contractAddress),
    token.totalSupply(),
  ]);

  console.log(`RPC: ${getRpcUrl()}`);
  console.log(`Chain ID: ${network.chainId.toString()}`);
  console.log(`Contract: ${contractAddress}`);
  console.log(`Token: ${metadata.name} (${metadata.symbol})`);
  console.log(`Decimals: ${metadata.decimals}`);
  console.log(`currencyId(): ${metadata.currencyId.toString()}`);
  console.log(`Total supply: ${formatTokenAmount(totalSupply, metadata.decimals)} ${metadata.symbol}`);

  if (!wallet) {
    console.log("Wallet: not provided");
    return;
  }

  const [nativeBalance, tokenBalance] = await Promise.all([
    provider.getBalance(wallet.address),
    token.balanceOf(wallet.address),
  ]);

  console.log(`Wallet: ${wallet.address}`);
  console.log(`Native balance: ${formatEther(nativeBalance)} REEF`);
  console.log(`Token balance: ${formatTokenAmount(tokenBalance, metadata.decimals)} ${metadata.symbol}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
