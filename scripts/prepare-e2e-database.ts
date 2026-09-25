import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';
import { getSafeE2EDatabaseEnvironment } from '../config/e2e-database';
import { loadLocalE2EEnvironment } from '../config/e2e-local-env';

type MigrationRow = {
  migration_name: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
};

const localMigrationNames = () =>
  readdirSync(join(process.cwd(), 'prisma', 'migrations'), {
    withFileTypes: true,
  })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

const schemaIsCurrent = async (databaseUrl: string, migrations: string[]) => {
  const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const rows = await client.$queryRaw<MigrationRow[]>(Prisma.sql`
      SELECT migration_name, finished_at, rolled_back_at
      FROM "_prisma_migrations"
    `);
    const byName = new Map(rows.map((row) => [row.migration_name, row]));
    const current = migrations.every((name) => {
      const row = byName.get(name);
      return Boolean(row?.finished_at && !row.rolled_back_at);
    });
    const healthy = rows.every((row) => row.finished_at && !row.rolled_back_at);
    process.stdout.write(`${migrations.length} local migrations found\n`);
    process.stdout.write(
      `${rows.filter((row) => row.finished_at && !row.rolled_back_at).length} applied migrations found\n`,
    );
    return current && healthy;
  } catch {
    return false;
  } finally {
    await client.$disconnect();
  }
};

const run = async () => {
  loadLocalE2EEnvironment();
  process.stdout.write('E2E database configuration loaded\n');
  const environment = getSafeE2EDatabaseEnvironment();
  process.stdout.write('E2E database safety check passed\n');
  const migrations = localMigrationNames();
  if (await schemaIsCurrent(environment.databaseUrl, migrations)) {
    process.stdout.write(
      'E2E schema already up to date; migration deploy skipped\n',
    );
  } else {
    const migration = spawnSync('pnpm', ['prisma', 'migrate', 'deploy'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: environment.directUrl,
        DIRECT_URL: environment.directUrl,
      },
      stdio: 'inherit',
    });
    if (migration.status !== 0) throw new Error('E2E_DATABASE_PREPARATION_FAILED');
  }
  const fixture = spawnSync('pnpm', ['exec', 'tsx', 'scripts/seed-e2e-fixtures.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: environment.databaseUrl,
      DIRECT_URL: environment.directUrl,
      NODE_ENV: 'development',
      E2E_ENV: 'local',
      E2E_ALLOW_MUTATIONS: 'true',
      ALLOW_QA_SEED: 'true',
      QA_SEED_ENV: 'local',
    },
    stdio: 'inherit',
  });
  if (fixture.status !== 0) throw new Error('E2E_DATABASE_PREPARATION_FAILED');
  process.stdout.write('E2E fixtures prepared\n');
};

run().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'E2E_DATABASE_PREPARATION_FAILED'}\n`,
  );
  process.exitCode = 1;
});
