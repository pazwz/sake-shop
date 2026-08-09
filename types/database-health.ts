import { API_VERSION, DATABASE_CONNECTED } from '@/config/api';

export interface DatabaseHealthResult {
  database: typeof DATABASE_CONNECTED;
  timestamp: string;
  version: typeof API_VERSION;
}
