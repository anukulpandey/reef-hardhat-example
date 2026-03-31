const { formatEther } = require("ethers");
const {
  formatTokenAmount,
  getContractAddress,
  getProvider,
  getRpcUrl,
  getToken,
  getTokenMetadata,
  parseTokenAmount,
  readAddressArg,
  requireWallet,
} = require("./lib/reef_erc20");

function shortError(error) {
  return error.shortMessage || error.reason || error.message;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

async function simulateMethod(provider, token, contractAddress, from, method, args) {
  const data = token.interface.encodeFunctionData(method, args);
  const tx = {
    to: contractAddress,
    from,
    data,
  };

  try {
    const [rawResult, gasEstimate] = await Promise.all([
      provider.call(tx),
      provider.estimateGas(tx),
    ]);

    const decoded = token.interface.decodeFunctionResult(method, rawResult);
    return {
      ok: true,
      gasEstimate,
      value: decoded.length === 1 ? decoded[0] : decoded,
    };
  } catch (error) {
    return {
      ok: false,
      error: shortError(error),
    };
  }
}

async function commitMethod(token, method, args) {
  const tx = await token[method](...args);
  const receipt = await tx.wait();
  return { txHash: tx.hash, blockNumber: receipt.blockNumber };
}

async function main() {
  const provider = getProvider();
  const wallet = requireWallet(provider);
  const contractAddress = getContractAddress();
  const token = getToken(wallet);
  const metadata = await getTokenMetadata(token, contractAddress);
  const commit = hasFlag("--commit");

  const approveSpender = readAddressArg("--spender", "SPENDER") || wallet.address;
  const transferRecipient = readAddressArg("--recipient", "RECIPIENT") || wallet.address;
  const transferFromOwner = readAddressArg("--from", "FROM") || wallet.address;
  const transferFromRecipient = readAddressArg("--to", "TO") || wallet.address;

  const approveAmount = await parseTokenAmount(token, "--approve-amount", "APPROVE_AMOUNT").catch(() => ({
    rawAmount: "0",
    decimals: metadata.decimals,
    value: 0n,
  }));
  const transferAmount = await parseTokenAmount(token, "--transfer-amount", "TRANSFER_AMOUNT").catch(() => ({
    rawAmount: "0",
    decimals: metadata.decimals,
    value: 0n,
  }));
  const transferFromAmount = await parseTokenAmount(token, "--transfer-from-amount", "TRANSFER_FROM_AMOUNT").catch(() => ({
    rawAmount: "0",
    decimals: metadata.decimals,
    value: 0n,
  }));

  const [nativeBalance, walletTokenBalance, startingAllowance] = await Promise.all([
    provider.getBalance(wallet.address),
    token.balanceOf(wallet.address),
    token.allowance(transferFromOwner, wallet.address),
  ]);

  console.log(`RPC: ${getRpcUrl()}`);
  console.log(`Contract: ${contractAddress}`);
  console.log(`Wallet: ${wallet.address}`);
  console.log(`Native balance: ${formatEther(nativeBalance)} REEF`);
  console.log(`Wallet token balance: ${formatTokenAmount(walletTokenBalance, metadata.decimals)} ${metadata.symbol}`);
  console.log(`Current allowance (from -> wallet): ${formatTokenAmount(startingAllowance, metadata.decimals)} ${metadata.symbol}`);

  const approveSimulation = await simulateMethod(
    provider,
    token,
    contractAddress,
    wallet.address,
    "approve",
    [approveSpender, approveAmount.value]
  );
  const transferSimulation = await simulateMethod(
    provider,
    token,
    contractAddress,
    wallet.address,
    "transfer",
    [transferRecipient, transferAmount.value]
  );
  const transferFromSimulation = await simulateMethod(
    provider,
    token,
    contractAddress,
    wallet.address,
    "transferFrom",
    [transferFromOwner, transferFromRecipient, transferFromAmount.value]
  );

  console.log("Write simulations:");
  console.log(
    `  approve(${approveSpender}, ${approveAmount.rawAmount}): ${
      approveSimulation.ok
        ? `ok return=${String(approveSimulation.value)} gas=${approveSimulation.gasEstimate.toString()}`
        : approveSimulation.error
    }`
  );
  console.log(
    `  transfer(${transferRecipient}, ${transferAmount.rawAmount}): ${
      transferSimulation.ok
        ? `ok return=${String(transferSimulation.value)} gas=${transferSimulation.gasEstimate.toString()}`
        : transferSimulation.error
    }`
  );
  console.log(
    `  transferFrom(${transferFromOwner}, ${transferFromRecipient}, ${transferFromAmount.rawAmount}): ${
      transferFromSimulation.ok
        ? `ok return=${String(transferFromSimulation.value)} gas=${transferFromSimulation.gasEstimate.toString()}`
        : transferFromSimulation.error
    }`
  );

  if (!commit) {
    console.log("Commit mode: off");
    console.log("Pass --commit to actually send approve/transfer/transferFrom transactions.");
    return;
  }

  if (nativeBalance === 0n) {
    throw new Error("Commit mode requested, but wallet has zero native balance for gas.");
  }

  console.log("Commit mode: on");

  if (!approveSimulation.ok || !transferSimulation.ok || !transferFromSimulation.ok) {
    throw new Error("One or more simulated writes failed; refusing to commit transactions.");
  }

  const approveResult = await commitMethod(token, "approve", [approveSpender, approveAmount.value]);
  console.log(`  approve tx: ${approveResult.txHash} block=${approveResult.blockNumber}`);

  const transferResult = await commitMethod(token, "transfer", [transferRecipient, transferAmount.value]);
  console.log(`  transfer tx: ${transferResult.txHash} block=${transferResult.blockNumber}`);

  const transferFromResult = await commitMethod(token, "transferFrom", [
    transferFromOwner,
    transferFromRecipient,
    transferFromAmount.value,
  ]);
  console.log(`  transferFrom tx: ${transferFromResult.txHash} block=${transferFromResult.blockNumber}`);

  const [endingWalletBalance, endingRecipientBalance, endingAllowance] = await Promise.all([
    token.balanceOf(wallet.address),
    token.balanceOf(transferFromRecipient),
    token.allowance(transferFromOwner, wallet.address),
  ]);

  console.log("Post-commit snapshot:");
  console.log(`  wallet balance: ${formatTokenAmount(endingWalletBalance, metadata.decimals)} ${metadata.symbol}`);
  console.log(`  recipient balance: ${formatTokenAmount(endingRecipientBalance, metadata.decimals)} ${metadata.symbol}`);
  console.log(`  allowance (from -> wallet): ${formatTokenAmount(endingAllowance, metadata.decimals)} ${metadata.symbol}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
