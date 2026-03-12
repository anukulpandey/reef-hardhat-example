const { ethers, network } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying REEFERC20 with account: ${deployer.address}`);
  console.log(`Network: ${network.name}`);

  const ReefERC20 = await ethers.getContractFactory("REEFERC20");
  const reefERC20 = await ReefERC20.deploy();
  await reefERC20.waitForDeployment();

  console.log(`REEFERC20 deployed to: ${await reefERC20.getAddress()}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
