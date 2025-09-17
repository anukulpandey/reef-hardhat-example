const axios = require("axios");

async function waitForIndexingAndVerify(contractAddress, contractName, verifyFn, maxRetries = 20, interval = 5000) {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      const resp = await axios.get(`${process.env.VERIFY_URL}/api/v2/smart-contracts/${contractAddress}`);
      if (resp.status === 200) {
        console.log("✅ Contract indexed on Blockscout. Attempting verification...");

        await verifyFn(contractAddress, contractName);
        return;
      }
    } catch (err) {
      if (err.response && err.response.status === 404) {
        console.log("⏳ Not indexed yet, retrying...");
      } else {
        console.error("Error checking index status:", err.message);
      }
    }

    retries++;
    await new Promise(r => setTimeout(r, interval));
  }
  throw new Error("❌ Contract not indexed/verified within retry limit");
}


module.exports = { waitForIndexingAndVerify };