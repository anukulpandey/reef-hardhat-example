const { spawnSync } = require("child_process");
const path = require("path");

const scripts = [
  "reef_erc20_info.js",
  "reef_erc20_state_dump.js",
  "reef_erc20_write_probe.js",
];

function runScript(scriptName, extraArgs) {
  const scriptPath = path.join(__dirname, scriptName);
  console.log(`\n=== Running ${scriptName} ===`);

  const result = spawnSync(process.execPath, [scriptPath, ...extraArgs], {
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function main() {
  const extraArgs = process.argv.slice(2);
  for (const scriptName of scripts) {
    runScript(scriptName, extraArgs);
  }
}

main();
