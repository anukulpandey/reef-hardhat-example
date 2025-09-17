const { artifacts } = require("hardhat");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");

async function verify(contractAddress, contractNameInput) {
  const artifact = await artifacts.readArtifact(contractNameInput);
  const buildInfo = await artifacts.getBuildInfo(`${artifact.sourceName}:${artifact.contractName}`);
  if (!buildInfo) {
    throw new Error("Build info not found, run `npx hardhat compile` first.");
  }

  const compilerVersion = buildInfo.solcLongVersion;
  const contractName = artifact.contractName;
  const sources = buildInfo.input.sources;
  const settings = buildInfo.input.settings;

  const standardJson = {
    language: "Solidity",
    sources,
    settings: {
      ...settings,
      outputSelection: {
        "*": {
          "": ["*"],
          "*": ["*"],
        },
      },
    },
  };

  const standardPath = path.join(__dirname, "..", "standard.json");
  fs.writeFileSync(standardPath, JSON.stringify(standardJson, null, 2));

  const form = new FormData();
  form.append("compiler_version", compilerVersion);
  form.append("contract_name", contractName);
  form.append("files[0]", fs.createReadStream(standardPath), {
    filename: "standard.json",
    contentType: "application/json",
  });
  form.append("autodetect_constructor_args", "false");
  form.append("license_type", artifact.license || "MIT");

  const url = `${process.env.VERIFY_URL}/api/v2/smart-contracts/${contractAddress}/verification/via/standard-input`;

  console.log("buildInfo===",buildInfo);

  try {
    console.log(`Uploading standard.json for ${contractName} at ${contractAddress}`);
    const resp = await axios.post(url, form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
    console.log("Verification response:", resp.status, resp.data);
  } catch (err) {
    if (err.response) {
      console.error("Verification failed:", err.response.status, err.response.data);
    } else {
      console.error("Error:", err.message);
    }
  }
}

module.exports = { verify };
