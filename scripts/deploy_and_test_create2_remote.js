const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const DEFAULT_RPC_URL = "http://34.123.142.246:8545";
const DEFAULT_SALT = 20260403n;

function loadArtifact(relativePath) {
  const absolutePath = path.join(__dirname, "..", relativePath);
  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}

function parseArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if (current === "--rpc" && next) {
      options.rpc = next;
      index += 1;
    } else if (current === "--private-key" && next) {
      options.privateKey = next;
      index += 1;
    } else if (current === "--salt" && next) {
      options.salt = BigInt(next);
      index += 1;
    }
  }

  return options;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function expectRevert(promise, message) {
  try {
    const tx = await promise;
    await tx.wait();
  } catch (error) {
    return error;
  }

  throw new Error(message);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const rpcUrl = options.rpc || process.env.CREATE2_RPC_URL || DEFAULT_RPC_URL;
  const privateKey =
    options.privateKey ||
    process.env.CREATE2_PRIVATE_KEY ||
    process.env.PRIVATE_KEY ||
    process.env.PASEO_PRIVATE_KEY;
  const salt = options.salt || (process.env.CREATE2_SALT ? BigInt(process.env.CREATE2_SALT) : DEFAULT_SALT);

  assert(privateKey, "Missing private key. Set CREATE2_PRIVATE_KEY or PRIVATE_KEY.");

  const factoryArtifact = loadArtifact("artifacts/contracts/Create2/Create2Factory.sol/Create2Factory.json");
  const childArtifact = loadArtifact("artifacts/contracts/Create2/Create2Factory.sol/DeployWithCreate2.json");

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const network = await provider.getNetwork();
  const factoryFactory = new ethers.ContractFactory(
    factoryArtifact.abi,
    factoryArtifact.bytecode,
    wallet
  );

  console.log(`RPC: ${rpcUrl}`);
  console.log(`Chain ID: ${network.chainId}`);
  console.log(`Deployer: ${wallet.address}`);
  console.log(`Salt: ${salt.toString()}`);

  const balance = await provider.getBalance(wallet.address);
  console.log(`Native balance: ${ethers.formatEther(balance)}`);

  const factory = await factoryFactory.deploy();
  await factory.waitForDeployment();

  const factoryAddress = await factory.getAddress();
  const bytecode = await factory.getBytecode(wallet.address);
  const predictedByContract = await factory.getFunction("getAddress").staticCall(bytecode, salt);
  const predictedByFormula = ethers.getCreate2Address(
    factoryAddress,
    ethers.zeroPadValue(ethers.toBeHex(salt), 32),
    ethers.keccak256(bytecode)
  );

  console.log(`Factory: ${factoryAddress}`);
  console.log(`Predicted by contract: ${predictedByContract}`);
  console.log(`Predicted by formula:  ${predictedByFormula}`);

  assert(
    predictedByContract === predictedByFormula,
    "Contract address prediction does not match ethers.getCreate2Address."
  );

  const codeBefore = await provider.getCode(predictedByContract);
  assert(codeBefore === "0x", "Predicted address already has deployed code before CREATE2 deploy.");

  const deployTx = await factory.deploy(salt);
  const deployReceipt = await deployTx.wait();
  const deployLog = deployReceipt.logs
    .map((log) => {
      try {
        return factory.interface.parseLog(log);
      } catch (error) {
        return null;
      }
    })
    .find((parsed) => parsed && parsed.name === "Deploy");

  assert(deployLog, "Deploy event was not found in the receipt.");
  assert(
    deployLog.args.addr === predictedByContract,
    "Deploy event address does not match the predicted CREATE2 address."
  );

  const codeAfter = await provider.getCode(predictedByContract);
  assert(codeAfter !== "0x", "No code was deployed at the predicted CREATE2 address.");

  const deployedChild = new ethers.Contract(predictedByContract, childArtifact.abi, provider);
  const storedOwner = await deployedChild.owner();

  assert(storedOwner === wallet.address, "Deployed child owner does not match the deployer.");

  await expectRevert(
    factory.deploy(salt),
    "Deploying twice with the same salt unexpectedly succeeded."
  );

  console.log("Remote CREATE2 deployment and verification passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
