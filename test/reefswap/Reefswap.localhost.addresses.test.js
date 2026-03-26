const { resolveLocalStackValue } = require("../../scripts/lib/local_stack_state");
const { expect } = require("chai");
const hre = require("hardhat");
const { ethers } = hre;

const DEPLOYMENT = {
  wrapped: resolveLocalStackValue("REEFSWAP_WREEF", "0x3C2BA92EAFAbA6A5aC21502D8C55d3A33950f7A6"),
  factory: resolveLocalStackValue("REEFSWAP_FACTORY", "0xDAb89107eaF290312fd8e80463A6a9Ec3D428F4A"),
  router: resolveLocalStackValue("REEFSWAP_ROUTER", "0xa3Cab0B7288fA4CAe22CcD8B1a80c4bFaDe27664"),
  chainId: BigInt(resolveLocalStackValue("REEF_CHAIN_ID", "13939")),
  walletRpc: resolveLocalStackValue("REEF_RPC_URL", "http://localhost:8545"),
  appTransportRpc: "/api/reef-rpc",
  subgraph: resolveLocalStackValue(
    "SUBGRAPH_GRAPHQL_ENDPOINT",
    "http://localhost:8000/subgraphs/name/uniswap-v2-localhost",
  ),
  explorer: resolveLocalStackValue("EXPLORER_BASE_URL", "https://reefscan.com"),
};

const ROUTER_ABI = [
  "function factory() external view returns (address)",
  "function WETH() external view returns (address)",
  "function addLiquidity(address,address,uint256,uint256,uint256,uint256,address,uint256) external returns (uint256,uint256,uint256)",
  "function swapExactTokensForTokens(uint256,uint256,address[],address,uint256) external returns (uint256[] memory)",
  "function getAmountsOut(uint256,address[]) external view returns (uint256[] memory)",
];

const FACTORY_ABI = [
  "function allPairsLength() external view returns (uint256)",
  "function allPairs(uint256) external view returns (address)",
  "function feeToSetter() external view returns (address)",
  "function getPair(address,address) external view returns (address)",
  "function createPair(address,address) external returns (address)",
];

const ERC20_META_ABI = [
  "function symbol() external view returns (string)",
  "function name() external view returns (string)",
  "function decimals() external view returns (uint8)",
  "function totalSupply() external view returns (uint256)",
];

const HARDHAT_FALLBACK_PRIVATE_KEYS = [
  // hardhat account #0
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  // hardhat account #2
  "0x5de4111afa1a4b94908f83103eb20cc27f236c95b40abaf0f7f880f6e309f995",
];

function flattenErrorText(error) {
  return [
    error?.message,
    error?.shortMessage,
    error?.error?.message,
    error?.error?.data?.message,
    typeof error?.code !== "undefined" ? String(error.code) : "",
    typeof error?.error?.code !== "undefined" ? String(error.error.code) : "",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isRpcWriteBlockedError(error) {
  const text = flattenErrorText(error);
  return (
    text.includes("temporarily banned") ||
    text.includes("invalid transaction") ||
    text.includes("code rejected") ||
    text.includes("coderejected") ||
    text.includes("code: 1010")
  );
}

function getAmountOut(amountIn, reserveIn, reserveOut) {
  const amountInWithFee = amountIn * 997n;
  return (amountInWithFee * reserveOut) / (reserveIn * 1000n + amountInWithFee);
}

async function signerAddress(signer) {
  return signer.address ?? signer.getAddress();
}

async function hasCode(address) {
  const code = await ethers.provider.getCode(address);
  return code !== "0x";
}

async function deadlineAfter(seconds = 1800) {
  const block = await ethers.provider.getBlock("latest");
  return BigInt(block.timestamp + seconds);
}

async function buildSignerCandidates(defaultSigner) {
  const candidates = [];
  if (defaultSigner) candidates.push(defaultSigner);

  if (process.env.TEST_PRIVATE_KEY) {
    candidates.push(new ethers.Wallet(process.env.TEST_PRIVATE_KEY, ethers.provider));
  }
  if (process.env.PRIVATE_KEY) {
    candidates.push(new ethers.Wallet(process.env.PRIVATE_KEY, ethers.provider));
  }

  for (const pk of HARDHAT_FALLBACK_PRIVATE_KEYS) {
    candidates.push(new ethers.Wallet(pk, ethers.provider));
  }

  const deduped = [];
  const seen = new Set();
  for (const signer of candidates) {
    if (!signer) continue;
    const address = (await signerAddress(signer)).toLowerCase();
    if (seen.has(address)) continue;
    seen.add(address);
    deduped.push(signer);
  }

  return deduped;
}

async function canWriteWithSigner(signer) {
  const address = await signerAddress(signer);
  const balance = await ethers.provider.getBalance(address);
  if (balance <= 0n) {
    return { ok: false, reason: `zero balance (${address})` };
  }

  try {
    // 0-value self-transfer probe
    const tx = await signer.sendTransaction({ to: address, value: 0n });
    await tx.wait();
    return { ok: true, reason: `probe tx ${tx.hash}` };
  } catch (error) {
    return { ok: false, reason: flattenErrorText(error) || "probe tx failed" };
  }
}

async function resolveWriteSigner() {
  const defaultSigners = await ethers.getSigners();
  const defaultSigner = defaultSigners[0];
  const candidates = await buildSignerCandidates(defaultSigner);
  const attempts = [];

  for (const signer of candidates) {
    const address = await signerAddress(signer);
    const probe = await canWriteWithSigner(signer);
    attempts.push({ address, ...probe });
    if (probe.ok) {
      return { signer, attempts };
    }
  }

  const detail = attempts
    .map((item) => `${item.address}: ${item.reason}`)
    .join(" | ");

  const network = await ethers.provider.getNetwork();
  throw new Error(
    `No writable signer available on network ${network.name || "unknown"} (chainId ${network.chainId}). ${detail}`
  );
}

async function tryRouterIntrospection(routerAddress) {
  if (!(await hasCode(routerAddress))) return null;
  const router = new ethers.Contract(routerAddress, ROUTER_ABI, ethers.provider);
  try {
    const [factory, wrapped] = await Promise.all([router.factory(), router.WETH()]);
    return { factory, wrapped };
  } catch {
    return null;
  }
}

async function isFactoryAddress(address) {
  if (!(await hasCode(address))) return false;
  const factory = new ethers.Contract(address, FACTORY_ABI, ethers.provider);
  try {
    await factory.allPairsLength();
    await factory.feeToSetter();
    return true;
  } catch {
    return false;
  }
}

async function isWrappedTokenAddress(address) {
  if (!(await hasCode(address))) return false;
  const token = new ethers.Contract(address, ERC20_META_ABI, ethers.provider);
  try {
    const symbol = (await token.symbol()).toUpperCase();
    const decimals = Number(await token.decimals());
    return (symbol === "WREEF" || symbol === "REEF") && decimals === 18;
  } catch {
    return false;
  }
}

async function fetchSubgraphCandidates() {
  const response = await fetch(DEPLOYMENT.subgraph, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: `
        query AddressCandidates {
          uniswapFactories(first: 1) { id }
          pairs(first: 50, orderBy: createdAtTimestamp, orderDirection: desc) {
            token0 { id symbol }
            token1 { id symbol }
          }
        }
      `,
    }),
  });

  if (!response.ok) return { factory: null, wrapped: null };
  const payload = await response.json();
  const data = payload?.data || {};

  const factory = data?.uniswapFactories?.[0]?.id || null;
  const pairTokens = Array.isArray(data?.pairs)
    ? data.pairs.flatMap((pair) => [pair?.token0, pair?.token1]).filter(Boolean)
    : [];

  const wrappedCandidate = pairTokens.find((token) => String(token?.symbol || "").toUpperCase() === "WREEF")?.id || null;
  return { factory, wrapped: wrappedCandidate };
}

async function resolveLiveAddresses() {
  const notes = [];

  const configuredFactoryValid = await isFactoryAddress(DEPLOYMENT.factory);
  const configuredWrappedValid = await isWrappedTokenAddress(DEPLOYMENT.wrapped);

  let effectiveFactory = configuredFactoryValid ? DEPLOYMENT.factory : null;
  let effectiveWrapped = configuredWrappedValid ? DEPLOYMENT.wrapped : null;

  if (!configuredFactoryValid) {
    notes.push(`Configured factory has no valid code: ${DEPLOYMENT.factory}`);
  }
  if (!configuredWrappedValid) {
    notes.push(`Configured wrapped has no valid code: ${DEPLOYMENT.wrapped}`);
  }

  const routerHasCode = await hasCode(DEPLOYMENT.router);
  const routerIntrospection = await tryRouterIntrospection(DEPLOYMENT.router);
  const routerIsValid = Boolean(routerIntrospection);

  if (routerHasCode && !routerIsValid) {
    const maybeToken = new ethers.Contract(DEPLOYMENT.router, ERC20_META_ABI, ethers.provider);
    try {
      const symbol = await maybeToken.symbol();
      notes.push(`Configured router ${DEPLOYMENT.router} is not Router02 (detected token symbol: ${symbol}).`);
    } catch {
      notes.push(`Configured router ${DEPLOYMENT.router} has code but is not callable as Router02.`);
    }
  }

  if (routerIntrospection) {
    if (!effectiveFactory && (await isFactoryAddress(routerIntrospection.factory))) {
      effectiveFactory = routerIntrospection.factory;
      notes.push(`Factory resolved from router.factory(): ${effectiveFactory}`);
    }
    if (!effectiveWrapped && (await isWrappedTokenAddress(routerIntrospection.wrapped))) {
      effectiveWrapped = routerIntrospection.wrapped;
      notes.push(`Wrapped resolved from router.WETH(): ${effectiveWrapped}`);
    }
  }

  if (!effectiveFactory || !effectiveWrapped) {
    const subgraph = await fetchSubgraphCandidates();
    if (!effectiveFactory && subgraph.factory && (await isFactoryAddress(subgraph.factory))) {
      effectiveFactory = subgraph.factory;
      notes.push(`Factory resolved from subgraph: ${effectiveFactory}`);
    }
    if (!effectiveWrapped && subgraph.wrapped && (await isWrappedTokenAddress(subgraph.wrapped))) {
      effectiveWrapped = subgraph.wrapped;
      notes.push(`Wrapped resolved from subgraph: ${effectiveWrapped}`);
    }
  }

  if (!effectiveFactory) throw new Error("Could not resolve a live Factory address from configured/router/subgraph sources");
  if (!effectiveWrapped) throw new Error("Could not resolve a live Wrapped token address from configured/router/subgraph sources");

  return {
    routerIsValid,
    effectiveFactory,
    effectiveWrapped,
    notes,
  };
}

async function resolveExistingSwapToken(factoryContract, wrappedAddress, signer) {
  const pairCount = Number(await factoryContract.allPairsLength());
  for (let index = 0; index < pairCount; index += 1) {
    const pairAddress = await factoryContract.allPairs(index);
    if (pairAddress === ethers.ZeroAddress) continue;
    const pair = await ethers.getContractAt("ReefswapV2Pair", pairAddress, signer);
    const token0 = await pair.token0();
    const token1 = await pair.token1();
    if (token0.toLowerCase() !== wrappedAddress.toLowerCase()) return token0;
    if (token1.toLowerCase() !== wrappedAddress.toLowerCase()) return token1;
  }
  return null;
}

async function getOrCreatePair(factory, tokenA, tokenB, signer) {
  let pairAddress = await factory.getPair(tokenA, tokenB);
  if (pairAddress === ethers.ZeroAddress) {
    await (await factory.connect(signer).createPair(tokenA, tokenB)).wait();
    pairAddress = await factory.getPair(tokenA, tokenB);
  }
  expect(pairAddress).to.not.equal(ethers.ZeroAddress);
  return ethers.getContractAt("ReefswapV2Pair", pairAddress, signer);
}

async function addLiquidityDirect(factory, tokenA, tokenB, amountA, amountB, signer) {
  const pair = await getOrCreatePair(factory, await tokenA.getAddress(), await tokenB.getAddress(), signer);
  const pairAddress = await pair.getAddress();

  await (await tokenA.connect(signer).transfer(pairAddress, amountA)).wait();
  await (await tokenB.connect(signer).transfer(pairAddress, amountB)).wait();
  await (await pair.connect(signer).mint(await signerAddress(signer))).wait();

  const [reserve0, reserve1] = await pair.getReserves();
  expect(reserve0).to.be.gt(0n);
  expect(reserve1).to.be.gt(0n);

  return pair;
}

async function swapExactViaPair(pair, tokenIn, tokenOut, amountIn, trader, txLabel) {
  const pairAddress = await pair.getAddress();
  const tokenInAddress = await tokenIn.getAddress();

  const traderAddress = await signerAddress(trader);
  const balanceOutBefore = await tokenOut.balanceOf(traderAddress);
  await (await tokenIn.connect(trader).transfer(pairAddress, amountIn)).wait();

  const [reserve0, reserve1] = await pair.getReserves();
  const token0 = await pair.token0();
  const tokenInIs0 = token0.toLowerCase() === tokenInAddress.toLowerCase();
  const reserveIn = tokenInIs0 ? reserve0 : reserve1;
  const reserveOut = tokenInIs0 ? reserve1 : reserve0;
  const amountOut = getAmountOut(amountIn, reserveIn, reserveOut);

  await (
    await pair.connect(trader).swap(
      tokenInIs0 ? 0n : amountOut,
      tokenInIs0 ? amountOut : 0n,
      traderAddress,
      "0x"
    )
  ).wait();

  const balanceOutAfter = await tokenOut.balanceOf(traderAddress);
  expect(balanceOutAfter, `${txLabel}: output token balance should increase`).to.be.gt(balanceOutBefore);
}

describe("ReefSwap localhost deployed-address integration", function () {
  this.timeout(300000);

  let signer;
  let factory;
  let wrapped;
  let router;

  let tokenA;
  let tokenB;
  let tokenC;

  let resolved;

  before(async function () {
    const signerResolution = await resolveWriteSigner();
    signer = signerResolution.signer;

    const network = await ethers.provider.getNetwork();
    expect(network.chainId).to.equal(DEPLOYMENT.chainId);

    resolved = await resolveLiveAddresses();

    factory = await ethers.getContractAt("ReefswapV2Factory", resolved.effectiveFactory, signer);
    wrapped = await ethers.getContractAt("WrappedREEF", resolved.effectiveWrapped, signer);

    if (resolved.routerIsValid) {
      router = await ethers.getContractAt("ReefswapV2Router02", DEPLOYMENT.router, signer);
    }

    const selectedAddress = await signerAddress(signer);
    console.log(`\\n[selected-signer] ${selectedAddress}`);

    if (signerResolution.attempts.length) {
      console.log("[signer-probe-results]");
      signerResolution.attempts.forEach((entry) => {
        console.log(`- ${entry.address} :: ${entry.ok ? "OK" : "BLOCKED"} :: ${entry.reason}`);
      });
      console.log("[end-signer-probe-results]");
    }

    if (resolved.notes.length) {
      console.log("[address-resolution-notes]");
      resolved.notes.forEach((note) => console.log(`- ${note}`));
      console.log("[end-address-resolution-notes]\\n");
    }
  });

  it("resolves live contracts from configured/router/subgraph sources", async function () {
    expect(await hasCode(resolved.effectiveFactory)).to.equal(true);
    expect(await hasCode(resolved.effectiveWrapped)).to.equal(true);
    expect(await factory.feeToSetter()).to.match(/^0x[a-fA-F0-9]{40}$/);

    const wrappedSymbol = await wrapped.symbol();
    expect(["WREEF", "REEF"]).to.include(String(wrappedSymbol).toUpperCase());
  });

  it("creates tokens, adds liquidity, and swaps (router if valid, else direct pair path)", async function () {
    try {
      let deployedFreshTokens = false;

      try {
        const Token = await ethers.getContractFactory("SimpleToken", signer);
        tokenA = await Token.deploy("Codex Graph Seed", "CGST", ethers.parseEther("2000000"));
        await tokenA.waitForDeployment();
        tokenB = await Token.deploy("Codex Lotus", "CLOT", ethers.parseEther("2000000"));
        await tokenB.waitForDeployment();
        tokenC = await Token.deploy("Codex Pearl", "CPRL", ethers.parseEther("2000000"));
        await tokenC.waitForDeployment();
        deployedFreshTokens = true;
      } catch (deployError) {
        if (!isRpcWriteBlockedError(deployError)) throw deployError;

        const wrappedAddress = await wrapped.getAddress();
        const existingTokenAddress = await resolveExistingSwapToken(factory, wrappedAddress, signer);
        if (!existingTokenAddress) {
          throw new Error(
            "Token deployment is blocked (CodeRejected/Invalid Transaction) and no existing non-WREEF token was found in indexed pairs."
          );
        }

        tokenA = await ethers.getContractAt("SimpleToken", existingTokenAddress, signer);
        tokenB = wrapped;
        tokenC = wrapped;
        console.log(
          `[fallback-token-mode] Token deployment blocked, using existing token ${existingTokenAddress} + wrapped ${wrappedAddress}.`
        );
      }

      const tokenAAddress = await tokenA.getAddress();
      const tokenBAddress = await tokenB.getAddress();
      const tokenCAddress = await tokenC.getAddress();
      const wrappedAddress = await wrapped.getAddress();
      const traderAddress = await signerAddress(signer);

      await (await wrapped.connect(signer).deposit({ value: ethers.parseEther("600") })).wait();

      if (resolved.routerIsValid && router) {
        await (await tokenA.connect(signer).approve(DEPLOYMENT.router, ethers.MaxUint256)).wait();
        await (await tokenB.connect(signer).approve(DEPLOYMENT.router, ethers.MaxUint256)).wait();
        if (deployedFreshTokens) {
          await (await tokenC.connect(signer).approve(DEPLOYMENT.router, ethers.MaxUint256)).wait();
        }
        await (await wrapped.connect(signer).approve(DEPLOYMENT.router, ethers.MaxUint256)).wait();

        await (
          await router.connect(signer).addLiquidity(
            tokenAAddress,
            tokenBAddress,
            ethers.parseEther("12000"),
            ethers.parseEther("6000"),
            0,
            0,
            traderAddress,
            await deadlineAfter()
          )
        ).wait();

        await (
          await router.connect(signer).addLiquidity(
            tokenAAddress,
            wrappedAddress,
            ethers.parseEther("8000"),
            ethers.parseEther("220"),
            0,
            0,
            traderAddress,
            await deadlineAfter()
          )
        ).wait();

        const pairAB = await factory.getPair(tokenAAddress, tokenBAddress);
        const pairAW = await factory.getPair(tokenAAddress, wrappedAddress);
        expect(pairAB).to.not.equal(ethers.ZeroAddress);
        expect(pairAW).to.not.equal(ethers.ZeroAddress);

        if (deployedFreshTokens) {
          await (await factory.connect(signer).createPair(tokenBAddress, tokenCAddress)).wait();
          const pairBC = await factory.getPair(tokenBAddress, tokenCAddress);
          expect(pairBC).to.not.equal(ethers.ZeroAddress);
        }

        const swapInAB = ethers.parseEther("15");
        const pathAB = [tokenAAddress, tokenBAddress];
        const quoteAB = await router.getAmountsOut(swapInAB, pathAB);
        const tokenBBefore = await tokenB.balanceOf(traderAddress);
        await (
          await router.connect(signer).swapExactTokensForTokens(
            swapInAB,
            (quoteAB[1] * 99n) / 100n,
            pathAB,
            traderAddress,
            await deadlineAfter()
          )
        ).wait();
        expect(await tokenB.balanceOf(traderAddress)).to.be.gt(tokenBBefore);

        const swapInAW = ethers.parseEther("5");
        const pathAW = [tokenAAddress, wrappedAddress];
        const quoteAW = await router.getAmountsOut(swapInAW, pathAW);
        const wrappedBefore = await wrapped.balanceOf(traderAddress);
        await (
          await router.connect(signer).swapExactTokensForTokens(
            swapInAW,
            (quoteAW[1] * 99n) / 100n,
            pathAW,
            traderAddress,
            await deadlineAfter()
          )
        ).wait();
        expect(await wrapped.balanceOf(traderAddress)).to.be.gt(wrappedBefore);
        return;
      }

      const pairAB = await addLiquidityDirect(
        factory,
        tokenA,
        tokenB,
        deployedFreshTokens ? ethers.parseEther("12000") : ethers.parseEther("200"),
        deployedFreshTokens ? ethers.parseEther("6000") : ethers.parseEther("10"),
        signer
      );

      const pairAW = await addLiquidityDirect(
        factory,
        tokenA,
        wrapped,
        deployedFreshTokens ? ethers.parseEther("8000") : ethers.parseEther("120"),
        deployedFreshTokens ? ethers.parseEther("220") : ethers.parseEther("6"),
        signer
      );

      if (deployedFreshTokens) {
        await (await factory.connect(signer).createPair(tokenBAddress, tokenCAddress)).wait();
        const pairBC = await factory.getPair(tokenBAddress, tokenCAddress);
        expect(pairBC).to.not.equal(ethers.ZeroAddress);
      } else {
        await addLiquidityDirect(factory, tokenA, wrapped, ethers.parseEther("20"), ethers.parseEther("1"), signer);
      }

      await swapExactViaPair(
        pairAB,
        tokenA,
        tokenB,
        deployedFreshTokens ? ethers.parseEther("15") : ethers.parseEther("3"),
        signer,
        "swap tokenA->tokenB"
      );
      await swapExactViaPair(
        pairAW,
        tokenA,
        wrapped,
        deployedFreshTokens ? ethers.parseEther("5") : ethers.parseEther("1"),
        signer,
        "swap tokenA->wrapped"
      );
      await swapExactViaPair(
        pairAW,
        wrapped,
        tokenA,
        deployedFreshTokens ? ethers.parseEther("0.8") : ethers.parseEther("0.2"),
        signer,
        "swap wrapped->tokenA"
      );
    } catch (error) {
      if (isRpcWriteBlockedError(error)) {
        throw new Error(
          [
            "Local RPC is currently rejecting write transactions ('Transaction is temporarily banned' / 'Invalid Transaction').",
            "This test includes token creation + liquidity + swap writes, so it cannot proceed until the node is unblocked.",
            "Action: restart/reseed your localhost node and retry this test.",
          ].join(" ")
        );
      }
      throw error;
    }
  });
});
