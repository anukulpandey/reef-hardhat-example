const { ethers } = require("hardhat");

const DEFAULTS = {
  factory: "0xD85d7B3BE238070F49bB0e3729aa799207267394",
  wrapped: "0x2949F87AB2e69ea07a91cef42e6987BEB2E5F45a",
};

const FACTORY_ABI = [
  "event PairCreated(address indexed token0, address indexed token1, address pair, uint256)",
  "function createPair(address tokenA, address tokenB) external returns (address pair)",
  "function getPair(address,address) external view returns (address)",
];

async function main() {
  const [deployer] = await ethers.getSigners();

  const factoryAddress = process.env.REEFSWAP_FACTORY || DEFAULTS.factory;
  const wrappedAddress = process.env.REEFSWAP_WRAPPED || DEFAULTS.wrapped;

  console.log("Using deployer:", deployer.address);
  console.log("Using Factory:", factoryAddress);
  console.log("Using WrappedREEF:", wrappedAddress);

  const codeFactory = await ethers.provider.getCode(factoryAddress);
  const codeWrapped = await ethers.provider.getCode(wrappedAddress);
  if (codeFactory === "0x" || codeWrapped === "0x") {
    throw new Error("One or more provided ReefSwap addresses have no deployed code");
  }

  const Token = await ethers.getContractFactory("SimpleToken");
  const token = await Token.deploy("Graph Seed Token", "GST", ethers.parseEther("1000000"));
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("Token deployed:", tokenAddress);

  const wrapped = await ethers.getContractAt("WrappedREEF", wrappedAddress);
  const factory = new ethers.Contract(factoryAddress, FACTORY_ABI, deployer);
  let pairAddress = await factory.getPair(tokenAddress, wrappedAddress);
  if (pairAddress === ethers.ZeroAddress) {
    const createPairTx = await factory.createPair(tokenAddress, wrappedAddress);
    await createPairTx.wait();
    console.log("createPair tx:", createPairTx.hash);
    pairAddress = await factory.getPair(tokenAddress, wrappedAddress);
  }
  console.log("pair address:", pairAddress);

  const pair = await ethers.getContractAt("ReefswapV2Pair", pairAddress);

  const depositTx = await wrapped.deposit({ value: ethers.parseEther("120") });
  await depositTx.wait();
  console.log("wrapped deposit tx:", depositTx.hash);

  const seedToken = ethers.parseEther("20000");
  const seedWrapped = ethers.parseEther("100");

  const tokenSeedTx = await token.transfer(pairAddress, seedToken);
  await tokenSeedTx.wait();
  console.log("token seed transfer tx:", tokenSeedTx.hash);

  const wrappedSeedTx = await wrapped.transfer(pairAddress, seedWrapped);
  await wrappedSeedTx.wait();
  console.log("wrapped seed transfer tx:", wrappedSeedTx.hash);

  const mintTx = await pair.mint(deployer.address);
  await mintTx.wait();
  console.log("mint tx:", mintTx.hash);

  const amountIn = ethers.parseEther("10");
  const [reserve0, reserve1] = await pair.getReserves();
  const token0 = (await pair.token0()).toLowerCase();
  const isToken0In = token0 === tokenAddress.toLowerCase();
  const reserveIn = isToken0In ? reserve0 : reserve1;
  const reserveOut = isToken0In ? reserve1 : reserve0;
  const amountInWithFee = amountIn * 997n;
  const amountOut = (amountInWithFee * reserveOut) / (reserveIn * 1000n + amountInWithFee);

  const swapInputTx = await token.transfer(pairAddress, amountIn);
  await swapInputTx.wait();
  console.log("swap input transfer tx:", swapInputTx.hash);

  const swapTx = await pair.swap(
    isToken0In ? 0n : amountOut,
    isToken0In ? amountOut : 0n,
    deployer.address,
    "0x"
  );
  await swapTx.wait();
  console.log("swap tx:", swapTx.hash);

  console.log("Done. Query subgraph for factories/pairs/swaps now.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
