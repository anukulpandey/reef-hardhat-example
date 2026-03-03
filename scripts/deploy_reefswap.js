const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying ReefSwapV2 contracts with: ${deployer.address}`);

  // 1. Deploy WREEF (Wrapped REEF — native token wrapper)
  console.log("\nDeploying WREEF...");
  const WREEF = await ethers.getContractFactory("WREEF");
  const wreef = await WREEF.deploy();
  await wreef.waitForDeployment();
  const wreefAddress = await wreef.getAddress();
  console.log(`WREEF deployed to: ${wreefAddress}`);

  // 2. Deploy ReefSwapV2Factory
  console.log("\nDeploying ReefSwapV2Factory...");
  const Factory = await ethers.getContractFactory("ReefSwapV2Factory");
  const factory = await Factory.deploy(deployer.address);
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log(`ReefSwapV2Factory deployed to: ${factoryAddress}`);

  // 3. Deploy ReefSwapV2Router02
  console.log("\nDeploying ReefSwapV2Router02...");
  const Router = await ethers.getContractFactory("ReefSwapV2Router02");
  const router = await Router.deploy(factoryAddress, wreefAddress);
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();
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
