const { ethers } = require("hardhat");

async function deploy() {
  [account] = await ethers.getSigners();
  deployerAddress = account.address;
  console.log(`Deploying contracts using ${deployerAddress}`);
  
  // Deploy Flipper
  console.log("Deploying Flipper...");
  const flipper = await ethers.getContractFactory("Flipper");
  const flipperInstance = await flipper.deploy(false);
  await flipperInstance.waitForDeployment();
  console.log(`Flipper deployed to : ${await flipperInstance.getAddress()}`);
  
}

deploy()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });