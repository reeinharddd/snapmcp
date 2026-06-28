#!/usr/bin/env bun
import { detectSystemState, bootstrapSetup, printSummary, ask, STEP, CHECK, BLUE } from "../dist/setup-shared.js";
import { detectMcpClients, registerSnapmcp, printRegistrationResults, printDetectedClients } from "../dist/register.js";

async function main() {
  /* Phase 1: System detection & bootstrap */
  const systemState = detectSystemState();
  await bootstrapSetup();
  printSummary(systemState);

  /* Phase 2: MCP auto-registration */
  const clients = detectMcpClients();
  if (clients.length > 0) {
    console.log("");
    console.log(`  ${BLUE("MCP Auto-Registration")}`);
    printDetectedClients(clients);

    const answer = await ask(
      "  Register snapmcp with detected MCP clients?",
      true,
    );
    if (answer) {
      const results = await registerSnapmcp();
      printRegistrationResults(results);
    } else {
      console.log(`  ${STEP} MCP registration skipped\n`);
    }
  }
}
main().catch(console.error);
