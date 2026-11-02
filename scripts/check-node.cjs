// Runs before `npm start`. Written in old-style JS so it works on any Node version and can
// explain the problem, instead of the server crashing with a cryptic error.
var parts = process.versions.node.split(".").map(Number);
var ok = parts[0] > 22 || (parts[0] === 22 && parts[1] >= 13);
if (!ok) {
  console.error("\n  QuoteSmith needs Node.js 22.13 or newer. You have " + process.version + ".\n");
  console.error("  Install the LTS version from https://nodejs.org (or `brew install node`),");
  console.error("  open a new terminal window, then run:\n");
  console.error("    rm -rf node_modules && npm install && npm start\n");
  process.exit(1);
}
