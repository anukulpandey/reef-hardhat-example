const fs = require('fs');
const path = require('path');
const { globSync } = require('fast-glob');
const { Wallet, JsonRpcProvider } = require('ethers');
const { createClient, Binary } = require('polkadot-api');
const { getWsProvider } = require('polkadot-api/ws-provider/web');

const MAGIC_DEPLOY_ADDRESS = '0x6d6f646c70792f70616464720000000000000000';
const ENDOWED_ACCOUNT_SS58 = '5Ha8yXQgvWcvpFya1BmjtJX386xUskafNTzU4Zmb6B3UwYd9';
const MAX_U128 = BigInt('0xffffffffffffffffffffffffffffffff');

function findParentBuildOutput(artifactsPath, sourcePath, contractName) {
  const buildFiles = globSync(`${artifactsPath}/build-info/*.json`)
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

  for (const file of buildFiles) {
    const build = JSON.parse(fs.readFileSync(file, 'utf8'));
    const contracts = build?.output?.contracts?.[sourcePath];
    const artifact = contracts?.[contractName];
    const deps = artifact?.factoryDependencies;
    if (artifact && deps && Object.keys(deps).length > 0) {
      return { file, artifact };
    }
  }

  throw new Error(`No build-info entry with factory dependencies found for ${sourcePath}:${contractName}`);
}

async function ensureFactoryDependencies({
  artifactsPath,
  ethRpcUrl,
  polkadotRpcUrl,
  privateKey,
  sourcePath,
  contractName,
}) {
  const { file, artifact } = findParentBuildOutput(artifactsPath, sourcePath, contractName);
  const deps = artifact.factoryDependencies || {};
  if (Object.keys(deps).length === 0) {
    console.log(`[factory-deps] ${contractName}: no dependencies to upload`);
    return;
  }

  const ethProvider = new JsonRpcProvider(ethRpcUrl);
  const wallet = new Wallet(privateKey, ethProvider);
  const dotProvider = getWsProvider(polkadotRpcUrl);
  const client = createClient(dotProvider);
  const api = client.getUnsafeApi();
  const runtimeToken = await api.runtimeToken;

  try {
    console.log(`[factory-deps] using build info: ${path.basename(file)}`);
    for (const [hash, identifier] of Object.entries(deps)) {
      const existing = await api.query.Revive.PristineCode.getValue(Binary.fromHex(hash));
      if (existing) {
        console.log(`[factory-deps] already uploaded: ${identifier} (${hash})`);
        continue;
      }

      const [childSourcePath, childContractName] = identifier.split(':');
      const artifactPath = path.join(artifactsPath, childSourcePath, `${childContractName}.json`);
      const childArtifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
      const bytecode = childArtifact.bytecode?.object ?? childArtifact.bytecode;
      if (!bytecode || bytecode === '0x') {
        throw new Error(`Missing bytecode for dependency ${identifier}`);
      }

      console.log(`[factory-deps] uploading: ${identifier} (${hash})`);
      const uploadCodeApi = await api.apis.ReviveApi.upload_code(
        ENDOWED_ACCOUNT_SS58,
        Binary.fromHex(bytecode),
        MAX_U128,
      );
      const call = api.tx.Revive.upload_code({
        code: Binary.fromHex(bytecode),
        storage_deposit_limit: uploadCodeApi.value?.deposit ?? MAX_U128,
      });
      const payload = call.getEncodedData(runtimeToken);
      const tx = await wallet.sendTransaction({
        to: MAGIC_DEPLOY_ADDRESS,
        data: payload.asHex(),
      });
      console.log(`[factory-deps] upload tx: ${tx.hash}`);
      await tx.wait();
    }
  } finally {
    client.destroy();
  }
}

module.exports = {
  ensureFactoryDependencies,
};
