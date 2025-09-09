const { ethers } = require("hardhat");

async function deploy() {
  [account] = await ethers.getSigners();
  deployerAddress = account.address;
  console.log(`Deploying contracts using ${deployerAddress}`);
  
  // Deploy SqwidERC1155
  console.log("Deploying SqwidERC1155...");
  const sqwidERC1155 = await ethers.getContractFactory("SqwidERC1155");
  const sqwidERC1155Instance = await sqwidERC1155.deploy();
  await sqwidERC1155Instance.waitForDeployment();
  const sqwidERC1155Address=await sqwidERC1155Instance.getAddress();
  console.log(`SqwidERC1155 deployed to : ${sqwidERC1155Address}`);
  

  // Deploy SqwidMarketplace
  console.log("Deploying SqwidMarketplace...");
  const SqwidMarketplace = await ethers.getContractFactory("SqwidMarketplace");
  const marketFee = 250; // 2.5%
  const sqwidMarketplaceInstance = await SqwidMarketplace.getDeployTransaction(marketFee, sqwidERC1155Address);
  console.log("sqwidMarketplaceInstance===",sqwidMarketplaceInstance)
  // await sqwidMarketplaceInstance.waitForDeployment();
  // const sqwidMarketplaceAddress = await sqwidMarketplaceInstance.getAddress();
  // console.log(`SqwidMarketplace deployed in ${sqwidMarketplaceAddress}`);

  // Deploy SqwidMarketplaceUtil
  console.log("Deploying SqwidMarketplaceUtil...");
  const SqwidMarketplaceUtil = await ethers.getContractFactory("SqwidMarketplaceUtil");
  const sqwidMarketplaceUtilInstance = await SqwidMarketplaceUtil.deploy(sqwidMarketplaceAddress);
  await sqwidMarketplaceUtilInstance.waitForDeployment();
  console.log(`SqwidMarketplaceUtil deployed in ${await sqwidMarketplaceUtilInstance.getAddress()}`);
  
}

deploy()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });