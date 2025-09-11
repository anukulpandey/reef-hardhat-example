require("@nomicfoundation/hardhat-toolbox");
require("@parity/hardhat-polkadot");

require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.4",
    
  },

  resolc: {
    compilerSource: "npm",
  },
  networks: {
    hardhat: {
      polkavm: true,
      forking: {
        url: "wss://westend-asset-hub-rpc.polkadot.io",
      },
      adapterConfig: {
        adapterBinaryPath: 'INSERT_PATH_TO_ETH_RPC_ADAPTER',
        dev: true,
      },
    },
    localNode: {
      polkavm: true,
      url: `http://127.0.0.1:8545`,
    },
    westend: {
      polkavm: true,
      url: 'https://westend-asset-hub-eth-rpc.polkadot.io',
      accounts: [process.env.PRIVATE_KEY],
    },
    reef: {
      polkavm: true,
      url: "http://34.56.133.26:8545",
      accounts: [process.env.PRIVATE_KEY],
      chainId:13939
    },
  },
};
