import { z } from 'zod';
import {
  getSmaregiBaseUrl,
  getSmaregiApiEnvironment,
  getSmaregiIdentityUrl,
  SMAREGI_MAX_RETRIES,
  SMAREGI_PAGE_SIZE,
  SMAREGI_READ_SCOPES,
  SMAREGI_REQUEST_TIMEOUT_MS,
  SMAREGI_TOKEN_EXPIRY_BUFFER_MS,
} from '@/config/smaregi';
import { AppError } from '@/lib/errors';
import {
  smaregiCategorySchema,
  smaregiConsumptionTaxRateSchema,
  smaregiProductSchema,
  smaregiReduceTaxRateSchema,
  smaregiStockSchema,
  smaregiStoreSchema,
  type SmaregiApiClient,
  type SmaregiCategory,
  type SmaregiConsumptionTaxRate,
  type SmaregiProduct,
  type SmaregiReduceTaxRate,
  type SmaregiStock,
  type SmaregiStore,
} from '@/types/smaregi';
import type { SmaregiApiEnvironment } from '@/config/env';

const tokenSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().positive(),
  token_type: z.literal('Bearer'),
});

type Fetch = typeof fetch;
type Sleep = (milliseconds: number) => Promise<void>;

export class SmaregiClient implements SmaregiApiClient {
  private token: { value: string; expiresAt: number } | null = null;
  private tokenRequest: Promise<string> | null = null;
  public retryCount = 0;

  public constructor(
    private readonly fetcher: Fetch = fetch,
    private readonly sleep: Sleep = (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
    private readonly environment?: SmaregiApiEnvironment,
  ) {}

  public getStores() {
    return this.getAll<SmaregiStore>('/stores', smaregiStoreSchema);
  }

  public getCategories() {
    return this.getAll<SmaregiCategory>('/categories', smaregiCategorySchema);
  }

  public getProducts() {
    return this.getAll<SmaregiProduct>('/products', smaregiProductSchema);
  }

  public getStock(storeId: string) {
    return this.getAll<SmaregiStock>('/stock', smaregiStockSchema, {
      store_id: storeId,
    });
  }

  public getConsumptionTaxRates() {
    return this.getAll<SmaregiConsumptionTaxRate>(
      '/consumption_tax_rates',
      smaregiConsumptionTaxRateSchema,
    );
  }

  public getReduceTaxRates() {
    return this.getAll<SmaregiReduceTaxRate>(
      '/reduce_tax_rates',
      smaregiReduceTaxRateSchema,
    );
  }

  private async getAll<T>(
    path: string,
    schema: z.ZodType<T, z.ZodTypeDef, unknown>,
    query: Record<string, string> = {},
  ): Promise<T[]> {
    const result: T[] = [];
    let page = 1;
    while (true) {
      const items = z.array(schema).parse(
        await this.request(path, {
          ...query,
          limit: String(SMAREGI_PAGE_SIZE),
          page: String(page),
        }),
      );
      result.push(...items);
      if (items.length < SMAREGI_PAGE_SIZE) return result;
      page += 1;
    }
  }

  private async request(path: string, query: Record<string, string>) {
    const config = this.environment ?? getSmaregiApiEnvironment();
    const url = new URL(
      `${getSmaregiBaseUrl(config.SMAREGI_ENVIRONMENT)}/${encodeURIComponent(config.SMAREGI_CONTRACT_ID)}/pos${path}`,
    );
    Object.entries(query).forEach(([key, value]) =>
      url.searchParams.set(key, value),
    );

    return this.withRetry(async () => {
      const response = await this.fetchWithTimeout(url, {
        headers: { Authorization: `Bearer ${await this.getAccessToken()}` },
      });
      if (!response.ok) {
        if (response.status === 401) this.token = null;
        throw await this.toError(response);
      }
      return response.json() as Promise<unknown>;
    });
  }

  private async getAccessToken() {
    if (this.token && this.token.expiresAt > Date.now())
      return this.token.value;
    if (this.tokenRequest) return this.tokenRequest;
    this.tokenRequest = this.requestAccessToken();
    try {
      return await this.tokenRequest;
    } finally {
      this.tokenRequest = null;
    }
  }

  private async requestAccessToken() {
    const config = this.environment ?? getSmaregiApiEnvironment();
    const credentials = Buffer.from(
      `${config.SMAREGI_CLIENT_ID}:${config.SMAREGI_CLIENT_SECRET}`,
    ).toString('base64');
    const response = await this.withRetry(async () => {
      const result = await this.fetchWithTimeout(
        `${getSmaregiIdentityUrl(config.SMAREGI_ENVIRONMENT)}/app/${encodeURIComponent(config.SMAREGI_CONTRACT_ID)}/token`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            scope: SMAREGI_READ_SCOPES.join(' '),
          }),
        },
      );
      if (!result.ok) throw await this.toError(result);
      return result;
    });
    const payload = tokenSchema.parse(await response.json());
    this.token = {
      value: payload.access_token,
      expiresAt:
        Date.now() + payload.expires_in * 1000 - SMAREGI_TOKEN_EXPIRY_BUFFER_MS,
    };
    return this.token.value;
  }

  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let retries = 0;
    this.retryCount = 0;
    while (true) {
      try {
        return await operation();
      } catch (error) {
        if (!this.isRetryable(error) || retries >= SMAREGI_MAX_RETRIES)
          throw error;
        const delay =
          error instanceof SmaregiClientError && error.retryAfterSeconds
            ? error.retryAfterSeconds * 1000
            : 250 * 2 ** retries;
        retries += 1;
        this.retryCount = retries;
        await this.sleep(delay);
      }
    }
  }

  private isRetryable(error: unknown) {
    return (
      error instanceof SmaregiClientError &&
      (error.statusCode === 429 || error.statusCode >= 500)
    );
  }

  private async fetchWithTimeout(input: RequestInfo | URL, init: RequestInit) {
    try {
      return await this.fetcher(input, {
        ...init,
        signal: AbortSignal.timeout(SMAREGI_REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new SmaregiClientError(
        error instanceof Error && error.name === 'TimeoutError'
          ? 'Smaregi request timed out.'
          : 'Smaregi network request failed.',
        503,
      );
    }
  }

  private async toError(response: Response) {
    const retryAfter = response.headers.get('retry-after');
    return new SmaregiClientError(
      `Smaregi request failed with status ${response.status}.`,
      response.status,
      retryAfter ? Number(retryAfter) : null,
    );
  }
}

export class SmaregiClientError extends AppError {
  public constructor(
    message: string,
    statusCode: number,
    public readonly retryAfterSeconds: number | null = null,
  ) {
    super(message, 'SMAREGI_API_ERROR', statusCode);
    this.name = 'SmaregiClientError';
  }
}
