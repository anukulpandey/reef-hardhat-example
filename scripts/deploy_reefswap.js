const hre = require("hardhat");
const { ethers } = require("hardhat");
const { ethers: ethersLib } = require("ethers");

// Hardhat's LocalAccountsProvider uses micro-eth-signer which enforces EIP-3860's
// 49,152-byte initcode limit. PolkaVM (resolc) bytecode is much larger, so we
// deploy large contracts by signing with ethers.js Wallet directly, bypassing
// that provider middleware.
async function deployLarge(contractName, constructorArgs, networkConfig) {
  const factory = await ethers.getContractFactory(contractName);
  const deployTx = await factory.getDeployTransaction(...constructorArgs);

  const provider = new ethersLib.JsonRpcProvider(networkConfig.url);
  const wallet = new ethersLib.Wallet(networkConfig.accounts[0], provider);

  const tx = await wallet.sendTransaction(deployTx);
  console.log(`  tx hash: ${tx.hash}`);
  const receipt = await tx.wait();
  return receipt.contractAddress;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const networkConfig = hre.network.config;
  console.log(`Deploying ReefSwapV2 contracts with: ${deployer.address}`);

  // 1. Deploy WREEF (small — goes through normal hardhat path)
  console.log("\nDeploying WREEF...");
  const WREEF = await ethers.getContractFactory("WREEF");
  const wreef = await WREEF.deploy();
  await wreef.waitForDeployment();
  const wreefAddress = await wreef.getAddress();
  console.log(`WREEF deployed to: ${wreefAddress}`);

  // 2. Deploy ReefSwapV2Factory (small — normal path)
  console.log("\nDeploying ReefSwapV2Factory...");
  const Factory = await ethers.getContractFactory("ReefSwapV2Factory");
  const factory = await Factory.deploy(deployer.address);
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log(`ReefSwapV2Factory deployed to: ${factoryAddress}`);

  // 3. Deploy ReefSwapV2Router02 (large — bypass micro-eth-signer EIP-3860 check)
  console.log("\nDeploying ReefSwapV2Router02...");
  const routerAddress = await deployLarge(
    "ReefSwapV2Router02",
    [factoryAddress, wreefAddress],
    networkConfig
  );
  console.log(`ReefSwapV2Router02 deployed to: ${routerAddress}`);

  console.log("\n--- Deployment Summary ---");
  console.log(`WREEF:              ${wreefAddress}`);
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
