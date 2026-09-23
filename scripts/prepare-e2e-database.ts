import { spawnSync } from 'node:child_process';
import { getSafeE2EDatabasePreparationEnvironment } from '../config/e2e-database';

const environment = getSafeE2EDatabasePreparationEnvironment();
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
];
for (const command of commands) {
  const result = spawnSync(command[0], command[1], {
    cwd: process.cwd(),
    env: safeEnvironment,
    stdio: 'inherit',
  });
  if (result.status !== 0) throw new Error('E2E_DATABASE_PREPARATION_FAILED');
}
