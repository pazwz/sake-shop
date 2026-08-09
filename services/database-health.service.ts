import { API_VERSION, DATABASE_CONNECTED } from '@/config/api';
import { DatabaseRepository } from '@/repositories/database.repository';
import type { DatabaseHealthResult } from '@/types/database-health';

export class DatabaseHealthService {
  public constructor(
    private readonly databaseRepository = new DatabaseRepository(),
  ) {}

  public async getHealth(): Promise<DatabaseHealthResult> {
    await this.databaseRepository.checkConnection();

    return {
      database: DATABASE_CONNECTED,
      timestamp: new Date().toISOString(),
      version: API_VERSION,
    };
  }
}
