const { ethers } = require("hardhat");

async function deploy() {
  [account] = await ethers.getSigners();
  deployerAddress = account.address;
  console.log(`Deploying contracts using ${deployerAddress}`);
  
  // Deploy ERC20
  console.log("Deploying MyToken...");
  const myToken = await ethers.getContractFactory("MyToken");
  const myTokenInstance = await myToken.deploy(deployerAddress);
  await myTokenInstance.waitForDeployment();
  console.log(`MyToken deployed to : ${await myTokenInstance.getAddress()}`);
  
}

deploy()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });