const { ethers, artifacts } = require("hardhat");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");
const { waitForIndexingAndVerify } = require("./utils/sleep");
const { verify } = require("./utils/verify");

async function deployAndVerify() {
  const [account] = await ethers.getSigners();
  console.log(`Deploying contracts using ${account.address}`);

  // Deploy Flipper
  const Flipper = await ethers.getContractFactory("Flipper");
  const flipper = await Flipper.deploy(false);
  await flipper.waitForDeployment();
  const contractAddress = await flipper.getAddress();
  console.log(`Flipper deployed to: ${contractAddress}`);

  // Verify Flipper
  await waitForIndexingAndVerify(contractAddress, "Flipper",verify);

}

deployAndVerify()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
