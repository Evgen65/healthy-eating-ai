import { formatChecks, runPreflightChecks } from "./helpers/environment";

/**
 * `npm run test:mobile:doctor` - the same preflight the suite runs before
 * any test, usable on its own while setting up the four terminals.
 */
async function main(): Promise<void> {
  const results = await runPreflightChecks();
  console.log(`Mobile environment preflight:\n${formatChecks(results)}`);
  if (results.some((result) => !result.ok)) {
    console.log("\nNot ready - fix the FAIL lines above (see tests/mobile/README.md).");
    process.exitCode = 1;
  } else {
    console.log("\nReady - run `npm run test:mobile`.");
  }
}

void main();
