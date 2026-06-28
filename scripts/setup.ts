#!/usr/bin/env bun
import { detectSystemState, bootstrapSetup, printSummary } from '../src/setup-shared.js';

async function main() {
  const systemState = detectSystemState();
  await bootstrapSetup();
  printSummary(systemState);
}
main().catch(console.error);
