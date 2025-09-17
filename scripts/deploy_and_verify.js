const { ethers, artifacts } = require("hardhat");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");
const { verify } = require("./utils/verify");
const { sleep } = require("./utils/sleep");

async function deployAndVerify() {
  const [account] = await ethers.getSigners();
  console.log(`Deploying contracts using ${account.address}`);

  // Deploy Flipper
  const Flipper = await ethers.getContractFactory("Flipper");
  const flipper = await Flipper.deploy(false);
  await flipper.waitForDeployment();
  const contractAddress = await flipper.getAddress();
  console.log(`Flipper deployed to: ${contractAddress}`);

  // wait for the contract to be indexed
  sleep(60000);

  // Verify Flipper
  const verification = await verify(contractAddress, "Flipper");

}

deployAndVerify()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
