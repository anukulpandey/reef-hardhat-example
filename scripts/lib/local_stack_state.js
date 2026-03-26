const fs = require("fs");
const path = require("path");

const DEFAULT_STATE_FILE = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "reef-evm-mobile-app",
  "tool",
  ".local_stack_state.json",
);

let cachedState;

function loadLocalStackState() {
  if (cachedState !== undefined) {
    return cachedState;
  }

  const candidates = [
    process.env.LOCAL_STACK_STATE_FILE,
    DEFAULT_STATE_FILE,
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    try {
      cachedState = JSON.parse(fs.readFileSync(candidate, "utf8"));
      return cachedState;
    } catch (error) {
      throw new Error(`Failed to parse local stack state file at ${candidate}: ${error.message || error}`);
    }
  }

  cachedState = null;
  return cachedState;
}

function resolveLocalStackValue(key, fallbackValue) {
  const state = loadLocalStackState();
  const value = state?.[key];
  if (value === undefined || value === null || value === "") {
    return fallbackValue;
  }
  return value;
}

module.exports = {
  DEFAULT_STATE_FILE,
  loadLocalStackState,
  resolveLocalStackValue,
};
