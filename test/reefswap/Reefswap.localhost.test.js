const { expect } = require("chai");
const hre = require("hardhat");
const { ethers } = hre;

const DEPLOYMENT = {
  wrapped: "0x67eA53a8d0bA2b2Ed73174107d6c39c88d4EF811",
  factory: "0x826287561cFBB1795E171268751d4481BA6d590B",
  router: "0x528c74cd79E1D9624f1d92B8C04bCb96C7cb350A",
  feeSetter: "0x051C64f41FAbDB6EE74767ff0390Cd52a0749d56",
};

describe("ReefSwap localhost deployment", function () {
  let provider;
  let signer;
  let factory;
  let router;
  let wrapped;

  before(async function () {
    provider = hre.ethers.provider;
    [signer] = await hre.ethers.getSigners();

    const factoryArtifact = await hre.artifacts.readArtifact("ReefswapV2Factory");
    const routerArtifact = await hre.artifacts.readArtifact("ReefswapV2Router02");
    const wrappedArtifact = await hre.artifacts.readArtifact("WrappedREEF");

    factory = new ethers.Contract(DEPLOYMENT.factory, factoryArtifact.abi, signer);
    router = new ethers.Contract(DEPLOYMENT.router, routerArtifact.abi, signer);
    wrapped = new ethers.Contract(DEPLOYMENT.wrapped, wrappedArtifact.abi, signer);
  });

  it("connects to deployed contracts at provided addresses", async function () {
    const factoryCode = await provider.getCode(DEPLOYMENT.factory);
    const routerCode = await provider.getCode(DEPLOYMENT.router);
    const wrappedCode = await provider.getCode(DEPLOYMENT.wrapped);

    expect(factoryCode).to.not.equal("0x");
    expect(routerCode).to.not.equal("0x");
    expect(wrappedCode).to.not.equal("0x");
    expect(DEPLOYMENT.feeSetter).to.match(/^0x[a-fA-F0-9]{40}$/);
  });

  it("supports wrapped native token deposit and withdraw on localhost", async function () {
    const depositAmount = ethers.parseEther("0.2");
    const withdrawAmount = ethers.parseEther("0.05");

    const before = await wrapped.balanceOf(signer.address);
    await wrapped.deposit({ value: depositAmount });
    const afterDeposit = await wrapped.balanceOf(signer.address);
    expect(afterDeposit - before).to.equal(depositAmount);

    await wrapped.withdraw(withdrawAmount);
    const afterWithdraw = await wrapped.balanceOf(signer.address);
    expect(afterWithdraw).to.equal(afterDeposit - withdrawAmount);
  });

  it("can instantiate local contract bindings for provided addresses", async function () {
    expect(await factory.getAddress()).to.equal(DEPLOYMENT.factory);
    expect(await router.getAddress()).to.equal(DEPLOYMENT.router);
    expect(await wrapped.getAddress()).to.equal(DEPLOYMENT.wrapped);
  });
});
