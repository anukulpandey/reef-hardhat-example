const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Create2Factory", function () {
  async function deployFactory() {
    const [deployer, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("Create2Factory");
    const factory = await Factory.deploy();
    await factory.waitForDeployment();
    return { deployer, other, factory };
  }

  it("deploys the child at the predicted CREATE2 address", async function () {
    const { deployer, factory } = await deployFactory();
    const salt = 123456n;
    const factoryAddress = await factory.getAddress();
    const bytecode = await factory.getBytecode(deployer.address);
    const predictedByContract = await factory.getFunction("getAddress").staticCall(bytecode, salt);
    const predictedByFormula = ethers.getCreate2Address(
      factoryAddress,
      ethers.zeroPadValue(ethers.toBeHex(salt), 32),
      ethers.keccak256(bytecode)
    );

    expect(predictedByContract).to.equal(predictedByFormula);
    expect(await ethers.provider.getCode(predictedByContract)).to.equal("0x");

    const tx = await factory.deploy(salt);
    const receipt = await tx.wait();
    const deployLog = receipt.logs
      .map((log) => {
        try {
          return factory.interface.parseLog(log);
        } catch (error) {
          return null;
        }
      })
      .find((parsed) => parsed && parsed.name === "Deploy");

    expect(deployLog.args.addr).to.equal(predictedByContract);

    const deployedContract = await ethers.getContractAt("DeployWithCreate2", predictedByContract);
    expect(await deployedContract.owner()).to.equal(deployer.address);
  });

  it("changes the predicted address when the constructor owner changes", async function () {
    const { deployer, other, factory } = await deployFactory();
    const salt = 999n;
    const ownerBytecode = await factory.getBytecode(deployer.address);
    const otherBytecode = await factory.getBytecode(other.address);

    const ownerPrediction = await factory.getFunction("getAddress").staticCall(ownerBytecode, salt);
    const otherPrediction = await factory.getFunction("getAddress").staticCall(otherBytecode, salt);

    expect(ownerPrediction).to.not.equal(otherPrediction);
  });

  it("rejects reusing the same salt", async function () {
    const { factory } = await deployFactory();
    const salt = 777n;

    await (await factory.deploy(salt)).wait();
    await expect(factory.deploy(salt)).to.be.reverted;
  });
});
