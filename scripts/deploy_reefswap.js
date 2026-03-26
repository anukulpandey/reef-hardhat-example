const hre = require("hardhat");
const { ethers } = require("hardhat");
const { ethers: ethersLib } = require("ethers");
const { ensureFactoryDependencies } = require("./lib/ensure_factory_dependencies");

// Hardhat's LocalAccountsProvider uses micro-eth-signer which enforces EIP-3860's
// 49,152-byte initcode limit. PolkaVM (resolc) bytecode is much larger (~157KB for
// Router02). Fix: sign with ethers.js Wallet connected to hardhat's own provider
// (so chainId, nonce, EIP-1559 gas params are all correct), then broadcast via
// eth_sendRawTransaction which bypasses LocalAccountsProvider's signing middleware.
async function deployLarge(contractName, constructorArgs) {
  const hreProvider = hre.ethers.provider;
  const privateKey = hre.network.config.accounts[0];

  const factory = await ethers.getContractFactory(contractName);
  const deployTx = await factory.getDeployTransaction(...constructorArgs);

  // Wallet uses hardhat's provider — ensures correct chainId, nonce, EIP-1559 params
  const wallet = new ethersLib.Wallet(privateKey, hreProvider);

  // Estimate gas (same value hardhat would use); fall back if estimation fails
  let gasLimit;
  try {
    gasLimit = await hreProvider.estimateGas({ ...deployTx, from: wallet.address });
  } catch {
    gasLimit = 10_000_000n;
  }

  // populateTransaction fills: chainId, nonce, maxFeePerGas (EIP-1559) from hreProvider
  const populated = await wallet.populateTransaction({ ...deployTx, gasLimit });

  // Sign directly — ethers.js Wallet has no initcode size restriction
  const signed = await wallet.signTransaction(populated);

  // Send raw: bypasses LocalAccountsProvider (which only intercepts eth_sendTransaction)
  const txHash = await hreProvider.send("eth_sendRawTransaction", [signed]);
  console.log(`  tx hash: ${txHash}`);

  // HardhatEthersProvider.waitForTransaction is not fully implemented — poll instead
  let receipt = null;
  while (!receipt) {
    await new Promise((r) => setTimeout(r, 2000));
    receipt = await hreProvider.getTransactionReceipt(txHash);
  }
  return receipt.contractAddress;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying upstream Reefswap contracts with: ${deployer.address}`);

  // 1. Deploy fresh wrapped native token for this deployment.
  console.log("\nDeploying WrappedREEF...");
  const WrappedREEF = await ethers.getContractFactory("WrappedREEF");
  const wrappedReef = await WrappedREEF.deploy();
  await wrappedReef.waitForDeployment();
  const wrappedNativeAddress = await wrappedReef.getAddress();
  console.log(`WrappedREEF deployed to: ${wrappedNativeAddress}`);

  // 2. Deploy ReefswapV2Factory (small — normal hardhat path)
  console.log("\nPreparing Reefswap factory dependencies...");
  await ensureFactoryDependencies({
    artifactsPath: hre.config.paths.artifacts,
    ethRpcUrl: hre.network.config.url,
    polkadotRpcUrl: hre.network.config.polkadotUrl,
    privateKey: hre.network.config.accounts[0],
    sourcePath: 'contracts/ReefSwap/ReefswapV2Factory.sol',
    contractName: 'ReefswapV2Factory',
  });

  console.log("\nDeploying ReefswapV2Factory...");
  const Factory = await ethers.getContractFactory("ReefswapV2Factory");
  const factory = await Factory.deploy(deployer.address);
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log(`ReefswapV2Factory deployed to: ${factoryAddress}`);

  // 3. Deploy ReefswapV2Router02 (large — bypass micro-eth-signer EIP-3860 check)
  console.log("\nDeploying ReefswapV2Router02...");
  const routerAddress = await deployLarge("ReefswapV2Router02", [
    factoryAddress,
    wrappedNativeAddress,
  ]);
  console.log(`ReefswapV2Router02 deployed to: ${routerAddress}`);

  console.log("\n--- Deployment Summary ---");
  console.log(`WrappedREEF:        ${wrappedNativeAddress}`);
  console.log(`Factory:            ${factoryAddress}`);
  console.log(`Router02:           ${routerAddress}`);
  console.log(`Fee setter:         ${deployer.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
