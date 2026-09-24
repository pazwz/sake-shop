import { spawnSync } from 'node:child_process';
import { getSafeE2EDatabasePreparationEnvironment } from '../config/e2e-database';
import { loadLocalE2EEnvironment } from '../config/e2e-local-env';

loadLocalE2EEnvironment();
process.stdout.write('E2E database configuration loaded\n');
const environment = getSafeE2EDatabasePreparationEnvironment();
process.stdout.write('E2E database safety check passed\n');
const safeEnvironment: NodeJS.ProcessEnv = {
  ...process.env,
  DATABASE_URL: environment.databaseUrl,
  DIRECT_URL: environment.directUrl,
  NODE_ENV: 'development',
  E2E_ENV: 'local',
  ALLOW_QA_SEED: 'true',
  QA_SEED_ENV: 'local',
};

const commands: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['pnpm', ['prisma', 'migrate', 'deploy']],
  ['pnpm', ['prisma', 'db', 'seed']],
  ['pnpm', ['exec', 'tsx', 'scripts/seed-e2e-fixtures.ts']],
];
for (const command of commands) {
  const result = spawnSync(command[0], command[1], {
    cwd: process.cwd(),
    env: safeEnvironment,
    stdio: 'inherit',
  });
  if (result.status !== 0) throw new Error('E2E_DATABASE_PREPARATION_FAILED');
}
