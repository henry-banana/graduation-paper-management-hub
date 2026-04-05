import { runSeedSheets } from '../src/scripts/seed-sheets';

void runSeedSheets().catch((err) => {
  console.error('❌  Seed failed:', err);
  process.exit(1);
});
