const { expect } = require("chai");
const hre = require("hardhat");
const { ethers } = hre;

const DEPLOYMENT = {
  wrapped: "0x3C2BA92EAFAbA6A5aC21502D8C55d3A33950f7A6",
  factory: "0xDAb89107eaF290312fd8e80463A6a9Ec3D428F4A",
  router: "0xa3Cab0B7288fA4CAe22CcD8B1a80c4bFaDe27664",
  chainId: 13939n,
  subgraph: "http://localhost:8000/subgraphs/name/uniswap-v2-localhost",
};

const ROUTER_ABI = [
  "function factory() external view returns (address)",
  "function WETH() external view returns (address)",
];

const FACTORY_ABI = [
  "function allPairsLength() external view returns (uint256)",
  "function feeToSetter() external view returns (address)",
];

const ERC20_META_ABI = [
  "function symbol() external view returns (string)",
  "function decimals() external view returns (uint8)",
];

const HARDHAT_FALLBACK_PRIVATE_KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
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

async function signerAddress(signer) {
  return signer.address ?? signer.getAddress();
}

async function hasCode(address) {
  const code = await ethers.provider.getCode(address);
  return code !== "0x";
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
    const tx = await signer.sendTransaction({ to: address, value: 0n });
    await tx.wait();
    return { ok: true, reason: `probe tx ${tx.hash}` };
  } catch (error) {
    return { ok: false, reason: flattenErrorText(error) || "probe tx failed" };
  }
}

async function resolveWriteSigner() {
  const defaultSigners = await ethers.getSigners();
  const candidates = await buildSignerCandidates(defaultSigners[0]);

  const attempts = [];
  for (const signer of candidates) {
    const address = await signerAddress(signer);
    const probe = await canWriteWithSigner(signer);
    attempts.push({ address, ...probe });
    if (probe.ok) {
      return { signer, attempts };
    }
  }

  const detail = attempts.map((item) => `${item.address}: ${item.reason}`).join(" | ");
  const network = await ethers.provider.getNetwork();
  throw new Error(`No writable signer available on ${network.name || "unknown"}/${network.chainId}. ${detail}`);
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
    const [symbol, decimals] = await Promise.all([token.symbol(), token.decimals()]);
    const normalized = String(symbol || "").toUpperCase();
    return (normalized === "WREEF" || normalized === "REEF") && Number(decimals) === 18;
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
  const wrapped = pairTokens.find((token) => String(token?.symbol || "").toUpperCase() === "WREEF")?.id || null;

  return { factory, wrapped };
}

async function resolveLiveAddresses() {
  const notes = [];
  const configuredFactoryValid = await isFactoryAddress(DEPLOYMENT.factory);
  const configuredWrappedValid = await isWrappedTokenAddress(DEPLOYMENT.wrapped);

  let effectiveFactory = configuredFactoryValid ? DEPLOYMENT.factory : null;
  let effectiveWrapped = configuredWrappedValid ? DEPLOYMENT.wrapped : null;

  if (!configuredFactoryValid) notes.push(`Configured factory has no valid code: ${DEPLOYMENT.factory}`);
  if (!configuredWrappedValid) notes.push(`Configured wrapped has no valid code: ${DEPLOYMENT.wrapped}`);

  const routerIntrospection = await tryRouterIntrospection(DEPLOYMENT.router);
  const routerIsValid = Boolean(routerIntrospection);
  if (!routerIsValid && (await hasCode(DEPLOYMENT.router))) {
    notes.push(`Configured router has code but is not callable as Router02: ${DEPLOYMENT.router}`);
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
    effectiveFactory,
    effectiveWrapped,
    effectiveRouter: routerIsValid ? DEPLOYMENT.router : null,
    notes,
  };
}

describe("ReefSwap localhost deployment", function () {
  this.timeout(120000);

  let provider;
  let signer;
  let factory;
  let router;
  let wrapped;
  let resolved;

  before(async function () {
    provider = hre.ethers.provider;

    const network = await provider.getNetwork();
    expect(network.chainId).to.equal(DEPLOYMENT.chainId);

    const signerResolution = await resolveWriteSigner();
    signer = signerResolution.signer;

    resolved = await resolveLiveAddresses();

    const factoryArtifact = await hre.artifacts.readArtifact("ReefswapV2Factory");
    const routerArtifact = await hre.artifacts.readArtifact("ReefswapV2Router02");
    const wrappedArtifact = await hre.artifacts.readArtifact("WrappedREEF");

    factory = new ethers.Contract(resolved.effectiveFactory, factoryArtifact.abi, signer);
    wrapped = new ethers.Contract(resolved.effectiveWrapped, wrappedArtifact.abi, signer);
    router = resolved.effectiveRouter
      ? new ethers.Contract(resolved.effectiveRouter, routerArtifact.abi, signer)
      : null;

    if (resolved.notes.length) {
      console.log("[localhost-resolution-notes]");
      resolved.notes.forEach((note) => console.log(`- ${note}`));
      console.log("[end-localhost-resolution-notes]");
    }
  });

  it("connects to deployed contracts at resolved live addresses", async function () {
    const factoryCode = await provider.getCode(resolved.effectiveFactory);
    const wrappedCode = await provider.getCode(resolved.effectiveWrapped);

    expect(factoryCode).to.not.equal("0x");
    expect(wrappedCode).to.not.equal("0x");
    expect(await factory.feeToSetter()).to.match(/^0x[a-fA-F0-9]{40}$/);

    if (resolved.effectiveRouter) {
      const routerCode = await provider.getCode(resolved.effectiveRouter);
      expect(routerCode).to.not.equal("0x");
    }
  });

  it("supports wrapped native token deposit and withdraw on localhost", async function () {
    const depositAmount = ethers.parseEther("0.2");
    const withdrawAmount = ethers.parseEther("0.05");

    try {
      const account = await signerAddress(signer);
      const before = await wrapped.balanceOf(account);
      await (await wrapped.deposit({ value: depositAmount })).wait();
      const afterDeposit = await wrapped.balanceOf(account);
      expect(afterDeposit - before).to.equal(depositAmount);

      await (await wrapped.withdraw(withdrawAmount)).wait();
      const afterWithdraw = await wrapped.balanceOf(account);
      expect(afterWithdraw).to.equal(afterDeposit - withdrawAmount);
    } catch (error) {
      if (isRpcWriteBlockedError(error)) {
        throw new Error(
          "Local RPC is rejecting write transactions right now ('Transaction is temporarily banned' / 'Invalid Transaction'). Restart/reseed localhost node and retry."
        );
      }
      throw error;
    }
  });

  it("can instantiate local contract bindings for resolved addresses", async function () {
    expect(await factory.getAddress()).to.equal(resolved.effectiveFactory);
    expect(await wrapped.getAddress()).to.equal(resolved.effectiveWrapped);
    if (router) {
      expect(await router.getAddress()).to.equal(resolved.effectiveRouter);
    }
  });
});
