const hre = require('hardhat');
const { ethers } = require('hardhat');
const { ensureFactoryDependencies } = require('./lib/ensure_factory_dependencies');

const ADDRESSES = {
  wrapped: '0xc14FA2CFcaB2F88Cdd8a7E8Be7222DB74b3e970b',
  factory: '0xFCB548Cced2360b298Bf9f02F21CB086A662cBB2',
  router: '0xD5B9E82936554CA8D65dE341574AA62877D1A7F1',
  token: '0xC3eB4D69B0Df904B2Cdad070829B4918Ea24A652',
};

function getAmountOut(amountIn, reserveIn, reserveOut) {
  const amountInWithFee = amountIn * 997n;
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * 1000n + amountInWithFee;
  return numerator / denominator;
}

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);

  await ensureFactoryDependencies({
    artifactsPath: hre.config.paths.artifacts,
    ethRpcUrl: hre.network.config.url,
    polkadotRpcUrl: hre.network.config.polkadotUrl,
    privateKey: hre.network.config.accounts[0],
    sourcePath: 'contracts/ReefSwap/ReefswapV2Factory.sol',
    contractName: 'ReefswapV2Factory',
  });

  const wrapped = await ethers.getContractAt('WrappedREEF', ADDRESSES.wrapped, deployer);
  const factory = await ethers.getContractAt('ReefswapV2Factory', ADDRESSES.factory, deployer);
  const token = await ethers.getContractAt('SimpleToken', ADDRESSES.token, deployer);

  await wait(5000);

  let pairAddress = await factory.getPair(ADDRESSES.token, ADDRESSES.wrapped);
  let pairCreatedBlock = null;
  if (pairAddress === ethers.ZeroAddress) {
    const createPairTx = await factory.createPair(ADDRESSES.token, ADDRESSES.wrapped);
    const createPairReceipt = await createPairTx.wait();
    pairCreatedBlock = createPairReceipt.blockNumber;
    pairAddress = await factory.getPair(ADDRESSES.token, ADDRESSES.wrapped);
    console.log(`createPair tx: ${createPairTx.hash}`);
  }

  console.log(`Pair: ${pairAddress}`);
  const pair = await ethers.getContractAt('ReefswapV2Pair', pairAddress, deployer);

  if ((await pair.totalSupply()) === 0n) {
    const depositTx = await wrapped.deposit({ value: ethers.parseEther('120') });
    await depositTx.wait();
    console.log(`wrapped.deposit tx: ${depositTx.hash}`);

    const transferTokenTx = await token.transfer(pairAddress, ethers.parseEther('20000'));
    await transferTokenTx.wait();
    console.log(`token->pair seed tx: ${transferTokenTx.hash}`);

    const transferWrappedTx = await wrapped.transfer(pairAddress, ethers.parseEther('100'));
    await transferWrappedTx.wait();
    console.log(`wrapped->pair seed tx: ${transferWrappedTx.hash}`);

    const mintTx = await pair.mint(deployer.address);
    await mintTx.wait();
    console.log(`mint tx: ${mintTx.hash}`);
  }

  const tokenIn = ethers.parseEther('10');
  const [reserve0A, reserve1A] = await pair.getReserves();
  const token0A = (await pair.token0()).toLowerCase();
  const tokenIs0 = token0A === ADDRESSES.token.toLowerCase();
  const reserveInA = tokenIs0 ? reserve0A : reserve1A;
  const reserveOutA = tokenIs0 ? reserve1A : reserve0A;
  const wrappedOut = getAmountOut(tokenIn, reserveInA, reserveOutA);
  const tokenInTx = await token.transfer(pairAddress, tokenIn);
  await tokenInTx.wait();
  console.log(`swap token->pair tx: ${tokenInTx.hash}`);
  const swap1 = await pair.swap(tokenIs0 ? 0n : wrappedOut, tokenIs0 ? wrappedOut : 0n, deployer.address, '0x');
  await swap1.wait();
  console.log(`swap token->wrapped tx: ${swap1.hash}`);

  const wrappedIn = ethers.parseEther('1');
  const [reserve0B, reserve1B] = await pair.getReserves();
  const token0B = (await pair.token0()).toLowerCase();
  const wrappedIs0 = token0B === ADDRESSES.wrapped.toLowerCase();
  const reserveInB = wrappedIs0 ? reserve0B : reserve1B;
  const reserveOutB = wrappedIs0 ? reserve1B : reserve0B;
  const tokenOut = getAmountOut(wrappedIn, reserveInB, reserveOutB);
  const wrappedInTx = await wrapped.transfer(pairAddress, wrappedIn);
  await wrappedInTx.wait();
  console.log(`swap wrapped->pair tx: ${wrappedInTx.hash}`);
  const swap2 = await pair.swap(wrappedIs0 ? 0n : tokenOut, wrappedIs0 ? tokenOut : 0n, deployer.address, '0x');
  await swap2.wait();
  console.log(`swap wrapped->token tx: ${swap2.hash}`);

  if (!pairCreatedBlock) {
    pairCreatedBlock = (await ethers.provider.getBlockNumber());
  }

  console.log('\n--- Summary ---');
  console.log(`WrappedREEF: ${ADDRESSES.wrapped}`);
  console.log(`Factory:     ${ADDRESSES.factory}`);
  console.log(`Router02:    ${ADDRESSES.router}`);
  console.log(`Token:       ${ADDRESSES.token}`);
  console.log(`Pair:        ${pairAddress}`);
  console.log(`startBlock:  ${pairCreatedBlock}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
