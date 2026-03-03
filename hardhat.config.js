require("@nomicfoundation/hardhat-toolbox");
require("@parity/hardhat-polkadot");

require("dotenv").config();

const hardhatPolkadotEnabled = process.env.HARDHAT_POLKADOT === "true";
const hardhatAdapterBinaryPath = process.env.ETH_RPC_ADAPTER_BINARY_PATH;

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
        },
    localNode: {
      polkadot: true,
      url: `http://127.0.0.1:8545`,
      accounts: [process.env.PRIVATE_KEY],
    },
    reef: {
      polkadot: true,
      url: 'http://34.56.133.26:8545',
      accounts: [process.env.PRIVATE_KEY],
    },
  },
};
