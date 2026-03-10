const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  const tokenName = process.env.TOKEN_NAME || "Sample Token";
  const tokenSymbol = process.env.TOKEN_SYMBOL || "SAMP";
  const tokenSupplyInput = process.env.TOKEN_INITIAL_SUPPLY || "1000000";
  const initialSupply = ethers.parseUnits(tokenSupplyInput, 18);

  console.log(`Deploying SimpleToken with account: ${deployer.address}`);
  console.log(`Token name: ${tokenName}`);
  console.log(`Token symbol: ${tokenSymbol}`);
  console.log(`Initial supply (18 decimals): ${initialSupply.toString()}`);

  const Token = await ethers.getContractFactory("SimpleToken");
  const token = await Token.deploy(tokenName, tokenSymbol, initialSupply);
  await token.waitForDeployment();

  console.log(`SimpleToken deployed to: ${await token.getAddress()}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
