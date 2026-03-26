const fs = require("fs");
const hre = require("hardhat");
const { ethers } = require("hardhat");
const { ethers: ethersLib } = require("ethers");
const { ensureFactoryDependencies } = require("./lib/ensure_factory_dependencies");

function getAmountOut(amountIn, reserveIn, reserveOut) {
  const amountInWithFee = amountIn * 997n;
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * 1000n + amountInWithFee;
  return numerator / denominator;
}

async function waitForReceipt(provider, txHash) {
  let receipt = null;
  while (!receipt) {
    await new Promise((r) => setTimeout(r, 1200));
    receipt = await provider.getTransactionReceipt(txHash);
  }
  return receipt;
}

async function sendRawTransaction(txRequest, { gasFallback = 12_000_000n } = {}) {
  const provider = hre.ethers.provider;
  const privateKey = hre.network.config.accounts[0];
  const wallet = new ethersLib.Wallet(privateKey, provider);

  let gasLimit;
  try {
    gasLimit = await provider.estimateGas({ ...txRequest, from: wallet.address });
  } catch {
    gasLimit = gasFallback;
  }

  const populated = await wallet.populateTransaction({ ...txRequest, gasLimit });
  const signed = await wallet.signTransaction(populated);
  const txHash = await provider.send("eth_sendRawTransaction", [signed]);
  const receipt = await waitForReceipt(provider, txHash);

  return { txHash, receipt };
}

async function deployLarge(contractName, constructorArgs, txOverrides = {}) {
  const factory = await ethers.getContractFactory(contractName);
  const deployTx = await factory.getDeployTransaction(...constructorArgs);
  const { txHash, receipt } = await sendRawTransaction({ ...deployTx, ...txOverrides });

  return { address: receipt.contractAddress, txHash };
}

async function deployContract(contractName, constructorArgs, txOverrides = {}) {
  return deployLarge(contractName, constructorArgs, txOverrides);
}

async function sendContractCall(contract, methodName, args = [], txOverrides = {}) {
  const txRequest = await contract[methodName].populateTransaction(...args);
  return sendRawTransaction({ ...txRequest, ...txOverrides });
}

async function main() {
  const provider = ethers.provider;
  const privateKey = hre.network.config.accounts[0];
  const deployer = new ethersLib.Wallet(privateKey, provider);
  const nextTxOverrides = async (overrides = {}) => ({
    ...overrides,
    nonce: await provider.getTransactionCount(deployer.address, "latest"),
  });
  console.log(`Deployer: ${deployer.address}`);

  await ensureFactoryDependencies({
    artifactsPath: hre.config.paths.artifacts,
    ethRpcUrl: hre.network.config.url,
    polkadotRpcUrl: hre.network.config.polkadotUrl,
    privateKey: hre.network.config.accounts[0],
    sourcePath: 'contracts/ReefSwap/ReefswapV2Factory.sol',
    contractName: 'ReefswapV2Factory',
  });
  const wrappedDeployment = await deployContract("WrappedREEF", [], await nextTxOverrides());
  const wrappedAddress = wrappedDeployment.address;
  const wrapped = await ethers.getContractAt("WrappedREEF", wrappedAddress, provider);
  console.log(`WrappedREEF: ${wrappedAddress}`);

  const factoryDeployment = await deployContract(
    "ReefswapV2Factory",
    [deployer.address],
    await nextTxOverrides(),
  );
  const factoryAddress = factoryDeployment.address;
  const factory = await ethers.getContractAt("ReefswapV2Factory", factoryAddress, provider);
  console.log(`Factory: ${factoryAddress}`);

  let routerAddress = ethers.ZeroAddress;
  try {
    const deployedRouter = await deployLarge(
      "ReefswapV2Router02",
      [factoryAddress, wrappedAddress],
      await nextTxOverrides(),
    );
    routerAddress = deployedRouter.address;
    console.log(`Router02: ${routerAddress}`);
    console.log(`Router deploy tx: ${deployedRouter.txHash}`);
  } catch (error) {
    console.log("Router deployment failed; continuing with Factory+Pair flow only.");
    console.log(String(error.message || error));
  }

  const tokenDeployment = await deployContract(
    "SimpleToken",
    ["Graph Seed Token", "GST", ethers.parseEther("1000000")],
    await nextTxOverrides(),
  );
  const tokenAddress = tokenDeployment.address;
  const token = await ethers.getContractAt("SimpleToken", tokenAddress, provider);
  console.log(`Token: ${tokenAddress}`);

  const createPairTx = await sendContractCall(
    factory,
    "createPair",
    [tokenAddress, wrappedAddress],
    await nextTxOverrides(),
  );
  const pairAddress = await factory.getPair(tokenAddress, wrappedAddress);
  console.log(`Pair: ${pairAddress}`);
  console.log(`createPair tx: ${createPairTx.txHash}`);

  const pair = await ethers.getContractAt("ReefswapV2Pair", pairAddress, provider);

  const depositTx = await sendContractCall(
    wrapped,
    "deposit",
    [],
    await nextTxOverrides({ value: ethers.parseEther("120") }),
  );
  console.log(`wrapped.deposit tx: ${depositTx.txHash}`);

  const seedToken = ethers.parseEther("20000");
  const seedWrapped = ethers.parseEther("100");

  const transferTokenTx = await sendContractCall(
    token,
    "transfer",
    [pairAddress, seedToken],
    await nextTxOverrides(),
  );
  console.log(`token->pair seed tx: ${transferTokenTx.txHash}`);

  const transferWrappedTx = await sendContractCall(
    wrapped,
    "transfer",
    [pairAddress, seedWrapped],
    await nextTxOverrides(),
  );
  console.log(`wrapped->pair seed tx: ${transferWrappedTx.txHash}`);

  const mintTx = await sendContractCall(
    pair,
    "mint",
    [deployer.address],
    await nextTxOverrides(),
  );
  console.log(`mint tx: ${mintTx.txHash}`);

  // Swap 1: token -> wrapped
  const tokenIn = ethers.parseEther("10");
  const [reserve0A, reserve1A] = await pair.getReserves();
  const token0A = (await pair.token0()).toLowerCase();
  const tokenIs0 = token0A === tokenAddress.toLowerCase();
  const reserveInA = tokenIs0 ? reserve0A : reserve1A;
  const reserveOutA = tokenIs0 ? reserve1A : reserve0A;
  const wrappedOut = getAmountOut(tokenIn, reserveInA, reserveOutA);

  const tokenInTx = await sendContractCall(
    token,
    "transfer",
    [pairAddress, tokenIn],
    await nextTxOverrides(),
  );

  const swap1 = await sendContractCall(
    pair,
    "swap",
    [tokenIs0 ? 0n : wrappedOut, tokenIs0 ? wrappedOut : 0n, deployer.address, "0x"],
    await nextTxOverrides(),
  );
  console.log(`swap token->wrapped tx: ${swap1.txHash}`);

  // Swap 2: wrapped -> token
  const wrappedIn = ethers.parseEther("1");
  const [reserve0B, reserve1B] = await pair.getReserves();
  const token0B = (await pair.token0()).toLowerCase();
  const wrappedIs0 = token0B === wrappedAddress.toLowerCase();
  const reserveInB = wrappedIs0 ? reserve0B : reserve1B;
  const reserveOutB = wrappedIs0 ? reserve1B : reserve0B;
  const tokenOut = getAmountOut(wrappedIn, reserveInB, reserveOutB);

  const wrappedInTx = await sendContractCall(
    wrapped,
    "transfer",
    [pairAddress, wrappedIn],
    await nextTxOverrides(),
  );

  const swap2 = await sendContractCall(
    pair,
    "swap",
    [wrappedIs0 ? 0n : tokenOut, wrappedIs0 ? tokenOut : 0n, deployer.address, "0x"],
    await nextTxOverrides(),
  );
  console.log(`swap wrapped->token tx: ${swap2.txHash}`);

  const pairCreatedBlock = createPairTx.receipt.blockNumber;

  console.log("\n--- Summary ---");
  console.log(`Factory:     ${factoryAddress}`);
  console.log(`WrappedREEF: ${wrappedAddress}`);
  console.log(`Router02:    ${routerAddress}`);
  console.log(`Token:       ${tokenAddress}`);
  console.log(`Pair:        ${pairAddress}`);
  console.log(`startBlock:  ${pairCreatedBlock}`);
  console.log("\nUse this factory + startBlock in your subgraph and reindex.");

  if (process.env.DEPLOYMENT_JSON_OUT) {
    const deploymentSummary = {
      deployer: deployer.address,
      wrapped: wrappedAddress,
      factory: factoryAddress,
      router: routerAddress,
      token: tokenAddress,
      pair: pairAddress,
      startBlock: String(pairCreatedBlock),
      transactions: {
        createPair: createPairTx.txHash,
        wrapDeposit: depositTx.txHash,
        tokenSeed: transferTokenTx.txHash,
        wrappedSeed: transferWrappedTx.txHash,
        mint: mintTx.txHash,
        swapTokenToWrapped: swap1.txHash,
        swapWrappedToToken: swap2.txHash,
      },
    };
    fs.writeFileSync(
      process.env.DEPLOYMENT_JSON_OUT,
      `${JSON.stringify(deploymentSummary, null, 2)}\n`,
      "utf8",
    );
    console.log(`Deployment JSON written to: ${process.env.DEPLOYMENT_JSON_OUT}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
