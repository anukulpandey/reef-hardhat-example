const { ethers } = require("hardhat");
const hre = require("hardhat");
const { ensureFactoryDependencies } = require("./lib/ensure_factory_dependencies");
const { resolveLocalStackValue } = require("./lib/local_stack_state");

const DEFAULTS = {
  factory: resolveLocalStackValue(
    "REEFSWAP_FACTORY",
    "0xDAb89107eaF290312fd8e80463A6a9Ec3D428F4A",
  ),
  wrapped: resolveLocalStackValue(
    "REEFSWAP_WREEF",
    "0x3C2BA92EAFAbA6A5aC21502D8C55d3A33950f7A6",
  ),
  tokenName: "Graph Seed Token",
  tokenSymbol: "GST",
  tokenSupply: "1000000",
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
  const tokenName = process.env.TOKEN_NAME || DEFAULTS.tokenName;
  const tokenSymbol = process.env.TOKEN_SYMBOL || DEFAULTS.tokenSymbol;
  const tokenSupply = process.env.TOKEN_SUPPLY || DEFAULTS.tokenSupply;

  console.log("Using deployer:", deployer.address);
  console.log("Using Factory:", factoryAddress);
  console.log("Using WrappedREEF:", wrappedAddress);
  console.log("Token seed config:", `${tokenName} (${tokenSymbol}) supply=${tokenSupply}`);

  const codeFactory = await ethers.provider.getCode(factoryAddress);
  const codeWrapped = await ethers.provider.getCode(wrappedAddress);
  if (codeFactory === "0x" || codeWrapped === "0x") {
    throw new Error("One or more provided ReefSwap addresses have no deployed code");
  }

  const Token = await ethers.getContractFactory("SimpleToken");
  const token = await Token.deploy(tokenName, tokenSymbol, ethers.parseEther(tokenSupply));
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("Token deployed:", tokenAddress);

  await ensureFactoryDependencies({
    artifactsPath: hre.config.paths.artifacts,
    ethRpcUrl: hre.network.config.url,
    polkadotRpcUrl: hre.network.config.polkadotUrl,
    privateKey: hre.network.config.accounts[0],
    sourcePath: 'contracts/ReefSwap/ReefswapV2Factory.sol',
    contractName: 'ReefswapV2Factory',
  });

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
