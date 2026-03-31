const { ethers } = require("ethers");
require("dotenv").config();

const DEFAULT_RPC_URL = "http://127.0.0.1:8545";
const DEFAULT_CONTRACT_ADDRESS = "0x0000000000000000000000000000000001000000";
const DEFAULT_METADATA = {
  name: "Reef",
  symbol: "REEF",
  decimals: 18,
  currencyId: 0n,
};

const REEF_ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function currencyId() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address recipient, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function transferFrom(address sender, address recipient, uint256 amount) returns (bool)",
];

function readArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1 || index === process.argv.length - 1) {
    return undefined;
  }

  return process.argv[index + 1];
}

function getRpcUrl() {
  return readArg("--rpc") || process.env.REEF_RPC_URL || DEFAULT_RPC_URL;
}

function getContractAddress() {
  const address = readArg("--contract") || process.env.REEF_ERC20_ADDRESS || DEFAULT_CONTRACT_ADDRESS;

  if (!ethers.isAddress(address)) {
    throw new Error(`Invalid REEF ERC20 contract address: ${address}`);
  }

  return ethers.getAddress(address);
}

function isDefaultReefContract(address) {
  return ethers.getAddress(address) === ethers.getAddress(DEFAULT_CONTRACT_ADDRESS);
}

function normalizePrivateKey(value) {
  if (!value) {
    return undefined;
  }

  return value.startsWith("0x") ? value : `0x${value}`;
}

function getPrivateKey() {
  return normalizePrivateKey(
    readArg("--private-key") || process.env.REEF_PRIVATE_KEY || process.env.PRIVATE_KEY
  );
}

function requireWallet(provider) {
  const privateKey = getPrivateKey();
  if (!privateKey) {
    throw new Error("Missing private key. Set REEF_PRIVATE_KEY or PRIVATE_KEY, or pass --private-key.");
  }

  return new ethers.Wallet(privateKey, provider);
}

function maybeGetWallet(provider) {
  const privateKey = getPrivateKey();
  return privateKey ? new ethers.Wallet(privateKey, provider) : undefined;
}

function getProvider() {
  return new ethers.JsonRpcProvider(getRpcUrl());
}

function getToken(runner) {
  return new ethers.Contract(getContractAddress(), REEF_ERC20_ABI, runner);
}

function readAddressArg(flagName, envName) {
  const value = readArg(flagName) || process.env[envName];
  if (!value) {
    return undefined;
  }

  if (!ethers.isAddress(value)) {
    throw new Error(`Invalid address for ${flagName}: ${value}`);
  }

  return ethers.getAddress(value);
}

async function parseTokenAmount(token, flagName, envName) {
  const rawAmount = readArg(flagName) || process.env[envName];
  if (!rawAmount) {
    throw new Error(`Missing amount. Pass ${flagName} or set ${envName}.`);
  }

  const decimals = await token.decimals();
  return {
    rawAmount,
    decimals,
    value: ethers.parseUnits(rawAmount, decimals),
  };
}

function formatTokenAmount(value, decimals) {
  return ethers.formatUnits(value, decimals);
}

async function getTokenMetadata(token, contractAddress = getContractAddress()) {
  const metadata = { ...DEFAULT_METADATA };

  try {
    metadata.decimals = await token.decimals();
  } catch (error) {
    if (!isDefaultReefContract(contractAddress)) {
      throw error;
    }
  }

  try {
    metadata.currencyId = await token.currencyId();
  } catch (error) {
    if (!isDefaultReefContract(contractAddress)) {
      throw error;
    }
  }

  try {
    metadata.name = await token.name();
  } catch (error) {
    if (!isDefaultReefContract(contractAddress)) {
      throw error;
    }
  }

  try {
    metadata.symbol = await token.symbol();
  } catch (error) {
    if (!isDefaultReefContract(contractAddress)) {
      throw error;
    }
  }

  return metadata;
}

module.exports = {
  formatTokenAmount,
  getContractAddress,
  getProvider,
  getRpcUrl,
  getTokenMetadata,
  getToken,
  maybeGetWallet,
  parseTokenAmount,
  readAddressArg,
  requireWallet,
};
