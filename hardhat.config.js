require("@nomicfoundation/hardhat-toolbox");
require("@parity/hardhat-polkadot");

const fs = require("fs");

require("dotenv").config();

function resolveLocalPrivateKey() {
  const validatorKeyJson = process.env.LOCAL_VALIDATOR_KEY_JSON || "/tmp/validator1.txt";

  if (process.env.LOCAL_PRIVATE_KEY) {
    return process.env.LOCAL_PRIVATE_KEY;
  }

  if (fs.existsSync(validatorKeyJson)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(validatorKeyJson, "utf8"));
      const secretSeed = String(parsed?.secretSeed || "").trim();
      if (/^0x[0-9a-fA-F]{64}$/.test(secretSeed)) {
        return secretSeed;
      }
    } catch (error) {
      // fall through to PRIVATE_KEY when the local validator file is unavailable
    }
  }

  return process.env.PRIVATE_KEY;
}

const localPrivateKey = resolveLocalPrivateKey();

const hardhatPolkadotEnabled = process.env.HARDHAT_POLKADOT === "true";
const hardhatAdapterBinaryPath = process.env.ETH_RPC_ADAPTER_BINARY_PATH;
const hardhatForkUrl = process.env.HARDHAT_FORK_URL;

if (hardhatPolkadotEnabled && !hardhatAdapterBinaryPath) {
  throw new Error(
    "HARDHAT_POLKADOT=true requires ETH_RPC_ADAPTER_BINARY_PATH to be set"
  );
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",
  resolc: {
    compilerSource: "npm",
    settings: {
      optimizer: {
        enabled: true,
        runs: 400,
      },
    },
    standardJson:true,
  },
  defaultNetwork:"reef",
  networks: {
    hardhat: hardhatPolkadotEnabled
      ? {
          polkadot: true,
          allowUnlimitedContractSize: true,
          forking: {
            url: "wss://westend-asset-hub-rpc.polkadot.io",
          },
          adapterConfig: {
            adapterBinaryPath: hardhatAdapterBinaryPath,
            dev: true,
          },
        }
      : {
          allowUnlimitedContractSize: true,
          ...(hardhatForkUrl
            ? {
                forking: {
                  url: hardhatForkUrl,
                },
              }
            : {}),
        },
    localNode: {
      polkadot: true,
      url: `http://127.0.0.1:8545`,
      polkadotUrl: process.env.LOCAL_POLKADOT_WS_URL || "ws://127.0.0.1:9944",
      accounts: [localPrivateKey],
    },
    localhost: {
      polkadot: true,
      polkadotUrl: process.env.LOCAL_POLKADOT_WS_URL || "ws://127.0.0.1:9944",
      url: "http://localhost:8545",
      accounts: [localPrivateKey],
    },
    localhost8545: {
      polkadotUrl: process.env.LOCAL_POLKADOT_WS_URL || "ws://127.0.0.1:9944",
      url: "http://127.0.0.1:8545",
      accounts: [localPrivateKey],
    },
    reef: {
      polkadot: true,
      url: 'http://34.56.133.26:8545',
      polkadotUrl: process.env.REEF_POLKADOT_WS_URL || "wss://rpc.reefscan.com/ws",
      accounts: [process.env.PRIVATE_KEY],
    },
  },
};
