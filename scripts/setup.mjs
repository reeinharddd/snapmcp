#!/usr/bin/env node
import { detectSystemState, bootstrapSetup, printSummary, ask, STEP, BLUE } from "../dist/setup-shared.js";
import { detectMcpClients, registerSnapmcp, printRegistrationResults, printDetectedClients } from "../dist/register.js";

async function main() {
  /* Phase 1: System detection & bootstrap */
  const systemState = detectSystemState();
  const clients = detectMcpClients();
  await bootstrapSetup();
  printSummary(systemState, clients);

  /* Phase 2: MCP auto-registration */
  if (clients.length > 0) {
    console.log("");
    console.log(`  ${BLUE("MCP Auto-Registration")}`);
    printDetectedClients(clients);

    const answer = await ask(
      "  Register snapmcp with detected MCP clients?",
      true,
    );
    if (answer) {
      const results = await registerSnapmcp(false, clients);
      printRegistrationResults(results);
    } else {
      console.log(`  ${STEP} MCP registration skipped\n`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
