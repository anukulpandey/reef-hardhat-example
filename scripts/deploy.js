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

  const sqwidErc1155Address = "0xca6224f40585618F1e5C430c37CfDFB43a9D08DD";
  console.log("Deployed SqwidERC1155 to : ",sqwidErc1155Address);

  // Deploy SqwidMarketplace
  console.log("Deploying SqwidMarketplaceBase...");
  const SqwidMarketplaceBase = await ethers.getContractFactory("SqwidMarketplaceBase");
  const marketFee = 250; // 2.5%
  const SqwidMarketplaceBaseInstance = await SqwidMarketplaceBase.deploy(marketFee, sqwidErc1155Address);
  await SqwidMarketplaceBaseInstance.waitForDeployment();
  const SqwidMarketplaceBaseAddress = await SqwidMarketplaceBaseInstance.getAddress();
  console.log(`SqwidMarketplaceBase deployed in ${SqwidMarketplaceBaseAddress}`);
  
  // Deploy SqwidMarketplaceAuctionModule
  console.log("Deploying SqwidMarketplaceAuctionModule...");
  const SqwidMarketplaceAuctionModule = await ethers.getContractFactory("SqwidMarketplaceAuctionModule");
  const SqwidMarketplaceAuctionModuleInstance = await SqwidMarketplaceAuctionModule.deploy(SqwidMarketplaceBaseAddress);
  await SqwidMarketplaceAuctionModuleInstance.waitForDeployment();
  const SqwidMarketplaceAuctionModuleAddress = await SqwidMarketplaceAuctionModuleInstance.getAddress();
  console.log(`SqwidMarketplaceAuctionModule deployed in ${SqwidMarketplaceAuctionModuleAddress}`);

  // Deploy SqwidMarketplaceLoanModule
  console.log("Deploying SqwidMarketplaceLoanModule...");
  const SqwidMarketplaceLoanModule = await ethers.getContractFactory("SqwidMarketplaceLoanModule");
  const SqwidMarketplaceLoanModuleInstance = await SqwidMarketplaceLoanModule.deploy(SqwidMarketplaceBaseAddress);
  await SqwidMarketplaceLoanModuleInstance.waitForDeployment();
  const SqwidMarketplaceLoanModuleAddress = await SqwidMarketplaceAuctionModuleInstance.getAddress();
  console.log(`SqwidMarketplaceLoanModule deployed in ${SqwidMarketplaceLoanModuleAddress}`);

  // Deploy SqwidMarketplaceRaffleModule
  console.log("Deploying SqwidMarketplaceRaffleModule...");
  const SqwidMarketplaceRaffleModule = await ethers.getContractFactory("SqwidMarketplaceRaffleModule");
  const SqwidMarketplaceRaffleModuleInstance = await SqwidMarketplaceRaffleModule.deploy(SqwidMarketplaceBaseAddress);
  await SqwidMarketplaceRaffleModuleInstance.waitForDeployment();
  const SqwidMarketplaceRaffleModuleAddress = await SqwidMarketplaceRaffleModuleInstance.getAddress();
  console.log(`SqwidMarketplaceRaffleModule deployed in ${SqwidMarketplaceRaffleModuleAddress}`);

  // Deploy SqwidMarketplaceSaleModule
  console.log("Deploying SqwidMarketplaceSaleModule...");
  const SqwidMarketplaceSaleModule = await ethers.getContractFactory("SqwidMarketplaceSaleModule");
  const SqwidMarketplaceSaleModuleInstance = await SqwidMarketplaceSaleModule.deploy(SqwidMarketplaceBaseAddress);
  await SqwidMarketplaceSaleModuleInstance.waitForDeployment();
  const SqwidMarketplaceSaleModuleAddress = await SqwidMarketplaceSaleModuleInstance.getAddress();
  console.log(`SqwidMarketplaceSaleModule deployed in ${SqwidMarketplaceSaleModuleAddress}`);

  // Deploy SqwidMarketplace
  console.log("Deploying SqwidMarketplace...");
  const SqwidMarketplace = await ethers.getContractFactory("SqwidMarketplace");
  const SqwidMarketplaceInstance = await SqwidMarketplace.deploy(SqwidMarketplaceSaleModuleAddress,SqwidMarketplaceRaffleModuleInstance,SqwidMarketplaceAuctionModuleInstance,SqwidMarketplaceLoanModuleInstance);
  await SqwidMarketplaceInstance.waitForDeployment();
  const SqwidMarketplaceInstanceAddress = await SqwidMarketplaceInstance.getAddress();
  console.log(`SqwidMarketplace deployed in ${SqwidMarketplaceInstanceAddress}`);

  // Deploy SqwidMarketplaceUtil
  console.log("Deploying SqwidMarketplaceUtil...");
  const SqwidMarketplaceUtil = await ethers.getContractFactory("SqwidMarketplaceUtil");
  const sqwidMarketplaceUtilInstance = await SqwidMarketplaceUtil.deploy(SqwidMarketplaceInstanceAddress);
  await sqwidMarketplaceUtilInstance.waitForDeployment();
  console.log(`SqwidMarketplaceUtil deployed in ${await sqwidMarketplaceUtilInstance.getAddress()}`);


  
}

deploy()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });