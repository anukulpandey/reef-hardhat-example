const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Flipper", function () {
  let Flipper, flipper, owner, addr1;

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();
    Flipper = await ethers.getContractFactory("Flipper");
    flipper = await Flipper.deploy(false);
    await flipper.waitForDeployment();
  });


  it("should get the initial value", async function () {
    expect(await flipper.get()).to.equal(false);
  });

  it("should get the changed value", async function () {
    await flipper.flip()
    expect(await flipper.get()).to.equal(true);
  });

});
