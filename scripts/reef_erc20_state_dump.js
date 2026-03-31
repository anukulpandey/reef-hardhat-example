const {
  formatTokenAmount,
  getContractAddress,
  getProvider,
  getRpcUrl,
  getToken,
  getTokenMetadata,
  maybeGetWallet,
  readAddressArg,
} = require("./lib/reef_erc20");

function shortError(error) {
  return error.shortMessage || error.reason || error.message;
}

async function probeRead(provider, token, contractAddress, method, args = []) {
  try {
    const data = token.interface.encodeFunctionData(method, args);
    const raw = await provider.call({
      to: contractAddress,
      data,
    });
    const decoded = token.interface.decodeFunctionResult(method, raw);
    return {
      ok: true,
      value: decoded.length === 1 ? decoded[0] : decoded,
    };
  } catch (error) {
    return {
      ok: false,
      error: shortError(error),
    };
  }
}

async function main() {
  const provider = getProvider();
  const wallet = maybeGetWallet(provider);
  const contractAddress = getContractAddress();
  const token = getToken(provider);
  const metadata = await getTokenMetadata(token, contractAddress);
  const network = await provider.getNetwork();
  const code = await provider.getCode(contractAddress);

  const owner = readAddressArg("--owner", "OWNER") || wallet?.address;
  const spender = readAddressArg("--spender", "SPENDER") || wallet?.address;
  const recipient = readAddressArg("--recipient", "RECIPIENT");
  const holder = readAddressArg("--address", "TARGET_ADDRESS");

  const addresses = [...new Set([wallet?.address, holder, owner, spender, recipient].filter(Boolean))];

  console.log(`RPC: ${getRpcUrl()}`);
  console.log(`Chain ID: ${network.chainId.toString()}`);
  console.log(`Contract: ${contractAddress}`);
  console.log(`Token: ${metadata.name} (${metadata.symbol})`);
  console.log(`Decimals: ${metadata.decimals}`);
  console.log(`currencyId(): ${metadata.currencyId.toString()}`);
  console.log(`Code size: ${Math.max((code.length - 2) / 2, 0)} bytes`);

  const [totalSupplyProbe, decimalsProbe, nameProbe, symbolProbe] = await Promise.all([
    probeRead(provider, token, contractAddress, "totalSupply"),
    probeRead(provider, token, contractAddress, "decimals"),
    probeRead(provider, token, contractAddress, "name"),
    probeRead(provider, token, contractAddress, "symbol"),
  ]);

  console.log("Read probes:");
  console.log(
    `  totalSupply(): ${totalSupplyProbe.ok ? formatTokenAmount(totalSupplyProbe.value, metadata.decimals) : totalSupplyProbe.error}`
  );
  console.log(`  decimals(): ${decimalsProbe.ok ? decimalsProbe.value.toString() : decimalsProbe.error}`);
  console.log(`  name(): ${nameProbe.ok ? nameProbe.value : nameProbe.error}`);
  console.log(`  symbol(): ${symbolProbe.ok ? symbolProbe.value : symbolProbe.error}`);

  if (!addresses.length) {
    console.log("No addresses supplied for balance snapshot.");
    return;
  }

  console.log("Balances:");
  for (const address of addresses) {
    const balance = await token.balanceOf(address);
    console.log(`  ${address}: ${formatTokenAmount(balance, metadata.decimals)} ${metadata.symbol}`);
  }

  if (owner && spender) {
    const [forwardAllowance, reverseAllowance] = await Promise.all([
      token.allowance(owner, spender),
      owner.toLowerCase() === spender.toLowerCase() ? Promise.resolve(null) : token.allowance(spender, owner),
    ]);

    console.log("Allowances:");
    console.log(`  owner -> spender: ${formatTokenAmount(forwardAllowance, metadata.decimals)} ${metadata.symbol}`);

    if (reverseAllowance !== null) {
      console.log(`  spender -> owner: ${formatTokenAmount(reverseAllowance, metadata.decimals)} ${metadata.symbol}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
