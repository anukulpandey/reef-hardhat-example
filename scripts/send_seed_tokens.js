const { ethers } = require("hardhat");

const RECIPIENTS = [
  "0x051C64f41FAbDB6EE74767ff0390Cd52a0749d56",
  "0xb541df2034abf38b327d8d44fa1a340b68443afa",
];

const TOKENS = [
  { symbol: "GST", address: "0xE62e53e27f461CAC135e9162FF055141956E2795", amount: "1000" },
  { symbol: "PC", address: "0x3e83956DD48Fe12e8eA97577955B784970b6A874", amount: "1000" },
  { symbol: "PSD", address: "0x8b1c80AFFa0535a23523505ae15e79B4E7dCb396", amount: "1000" },
];

async function main() {
  const [signer] = await ethers.getSigners();
  console.log(`Using signer: ${signer.address}`);

  for (const tokenInfo of TOKENS) {
    const token = await ethers.getContractAt("SimpleToken", tokenInfo.address, signer);
    for (const recipient of RECIPIENTS) {
      const tx = await token.transfer(recipient, ethers.parseEther(tokenInfo.amount));
      await tx.wait();
      const balance = await token.balanceOf(recipient);
      console.log(`${tokenInfo.symbol} -> ${recipient}: tx=${tx.hash} balance=${ethers.formatEther(balance)}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
