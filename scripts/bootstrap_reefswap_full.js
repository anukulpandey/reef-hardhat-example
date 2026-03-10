const hre = require("hardhat");
const { ethers } = require("hardhat");
const { ethers: ethersLib } = require("ethers");

function getAmountOut(amountIn, reserveIn, reserveOut) {
  const amountInWithFee = amountIn * 997n;
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * 1000n + amountInWithFee;
  return numerator / denominator;
}

// For large PolkaVM initcode (Router), bypass LocalAccountsProvider signer middleware.
async function deployLarge(contractName, constructorArgs) {
  const provider = hre.ethers.provider;
  const privateKey = hre.network.config.accounts[0];

  const factory = await ethers.getContractFactory(contractName);
  const deployTx = await factory.getDeployTransaction(...constructorArgs);

  const wallet = new ethersLib.Wallet(privateKey, provider);

  let gasLimit;
  try {
    gasLimit = await provider.estimateGas({ ...deployTx, from: wallet.address });
  } catch {
    gasLimit = 12_000_000n;
  }

  const populated = await wallet.populateTransaction({ ...deployTx, gasLimit });
  const signed = await wallet.signTransaction(populated);
  const txHash = await provider.send("eth_sendRawTransaction", [signed]);

  let receipt = null;
  while (!receipt) {
    await new Promise((r) => setTimeout(r, 1200));
    receipt = await provider.getTransactionReceipt(txHash);
  }

  return { address: receipt.contractAddress, txHash };
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);

  const Wrapped = await ethers.getContractFactory("WrappedREEF");
  const Factory = await ethers.getContractFactory("ReefswapV2Factory");

  const wrapped = await Wrapped.deploy();
  await wrapped.waitForDeployment();
  const wrappedAddress = await wrapped.getAddress();
  console.log(`WrappedREEF: ${wrappedAddress}`);

  const factory = await Factory.deploy(deployer.address);
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log(`Factory: ${factoryAddress}`);

  let routerAddress = ethers.ZeroAddress;
  try {
    const deployedRouter = await deployLarge("ReefswapV2Router02", [factoryAddress, wrappedAddress]);
    routerAddress = deployedRouter.address;
    console.log(`Router02: ${routerAddress}`);
    console.log(`Router deploy tx: ${deployedRouter.txHash}`);
  } catch (error) {
    console.log("Router deployment failed; continuing with Factory+Pair flow only.");
    console.log(String(error.message || error));
  }

  const Token = await ethers.getContractFactory("SimpleToken");
  const token = await Token.deploy("Graph Seed Token", "GST", ethers.parseEther("1000000"));
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log(`Token: ${tokenAddress}`);

  const createPairTx = await factory.createPair(tokenAddress, wrappedAddress);
  await createPairTx.wait();
  const pairAddress = await factory.getPair(tokenAddress, wrappedAddress);
  console.log(`Pair: ${pairAddress}`);
  console.log(`createPair tx: ${createPairTx.hash}`);

  const pair = await ethers.getContractAt("ReefswapV2Pair", pairAddress);

  const depositTx = await wrapped.deposit({ value: ethers.parseEther("120") });
  await depositTx.wait();
  console.log(`wrapped.deposit tx: ${depositTx.hash}`);

  const seedToken = ethers.parseEther("20000");
  const seedWrapped = ethers.parseEther("100");

  const transferTokenTx = await token.transfer(pairAddress, seedToken);
  await transferTokenTx.wait();
  console.log(`token->pair seed tx: ${transferTokenTx.hash}`);

  const transferWrappedTx = await wrapped.transfer(pairAddress, seedWrapped);
  await transferWrappedTx.wait();
  console.log(`wrapped->pair seed tx: ${transferWrappedTx.hash}`);

  const mintTx = await pair.mint(deployer.address);
  await mintTx.wait();
  console.log(`mint tx: ${mintTx.hash}`);

  // Swap 1: token -> wrapped
  const tokenIn = ethers.parseEther("10");
  const [reserve0A, reserve1A] = await pair.getReserves();
  const token0A = (await pair.token0()).toLowerCase();
  const tokenIs0 = token0A === tokenAddress.toLowerCase();
  const reserveInA = tokenIs0 ? reserve0A : reserve1A;
  const reserveOutA = tokenIs0 ? reserve1A : reserve0A;
  const wrappedOut = getAmountOut(tokenIn, reserveInA, reserveOutA);

  const tokenInTx = await token.transfer(pairAddress, tokenIn);
  await tokenInTx.wait();

  const swap1 = await pair.swap(tokenIs0 ? 0n : wrappedOut, tokenIs0 ? wrappedOut : 0n, deployer.address, "0x");
  await swap1.wait();
  console.log(`swap token->wrapped tx: ${swap1.hash}`);

  // Swap 2: wrapped -> token
  const wrappedIn = ethers.parseEther("1");
  const [reserve0B, reserve1B] = await pair.getReserves();
  const token0B = (await pair.token0()).toLowerCase();
  const wrappedIs0 = token0B === wrappedAddress.toLowerCase();
  const reserveInB = wrappedIs0 ? reserve0B : reserve1B;
  const reserveOutB = wrappedIs0 ? reserve1B : reserve0B;
  const tokenOut = getAmountOut(wrappedIn, reserveInB, reserveOutB);

  const wrappedInTx = await wrapped.transfer(pairAddress, wrappedIn);
  await wrappedInTx.wait();

  const swap2 = await pair.swap(wrappedIs0 ? 0n : tokenOut, wrappedIs0 ? tokenOut : 0n, deployer.address, "0x");
  await swap2.wait();
  console.log(`swap wrapped->token tx: ${swap2.hash}`);

  const pairCreatedBlock = (await ethers.provider.getTransactionReceipt(createPairTx.hash)).blockNumber;

  console.log("\n--- Summary ---");
  console.log(`Factory:     ${factoryAddress}`);
  console.log(`WrappedREEF: ${wrappedAddress}`);
  console.log(`Router02:    ${routerAddress}`);
  console.log(`Token:       ${tokenAddress}`);
  console.log(`Pair:        ${pairAddress}`);
  console.log(`startBlock:  ${pairCreatedBlock}`);
  console.log("\nUse this factory + startBlock in your subgraph and reindex.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
