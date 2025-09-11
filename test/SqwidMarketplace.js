const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SqwidMarketPlace", function () {
  let sqwidMarketplace, owner, addr1;

  // use the address you already deployed
  const deployedMarketplaceAddress = "0xcD574ff90f85183a46cE65c79d3405189adc414E";

  before(async function () {
    [owner, addr1] = await ethers.getSigners();

    // attach to deployed contract instead of deploying new
    sqwidMarketplace = await ethers.getContractAt(
      "SqwidMarketplace",
      deployedMarketplaceAddress
    );
  });

  it("should have correct market fee", async function () {
    const fee = await sqwidMarketplace.getMarketFee(1);
    expect(fee).to.equal(250); // adjust based on your constructor
  });
});
