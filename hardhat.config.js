require("@nomicfoundation/hardhat-toolbox");
require("@parity/hardhat-polkadot");

require("dotenv").config();

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
      accounts: [process.env.PRIVATE_KEY],
    },
    localhost: {
      polkadot: true,
      polkadotUrl: process.env.LOCAL_POLKADOT_WS_URL || "ws://127.0.0.1:9944",
      url: "http://localhost:8545",
      accounts: [process.env.PRIVATE_KEY],
    },
    localhost8545: {
      polkadotUrl: process.env.LOCAL_POLKADOT_WS_URL || "ws://127.0.0.1:9944",
      url: "http://127.0.0.1:8545",
      accounts: [process.env.PRIVATE_KEY],
    },
    reef: {
      polkadot: true,
      url: 'http://34.56.133.26:8545',
      polkadotUrl: process.env.REEF_POLKADOT_WS_URL || "wss://rpc.reefscan.com/ws",
      accounts: [process.env.PRIVATE_KEY],
    },
  },
};
