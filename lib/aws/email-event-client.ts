import { awsCredentialsProvider } from '@vercel/oidc-aws-credentials-provider';

export const PRODUCTION_EMAIL_APP_ROLE_ARN = 'arn:aws:iam::108782085732:role/sake-shop-production-email-app';

export const getEmailAwsClientConfig = (
  environment: Record<string, string | undefined> = process.env,
  provider: typeof awsCredentialsProvider = awsCredentialsProvider,
): { region?: string; credentials?: ReturnType<typeof awsCredentialsProvider> } => {
  const production = environment.VERCEL_ENV === 'production' ||
    (environment.NODE_ENV === 'production' && !environment.VERCEL_ENV);
  const roleArn = environment.EMAIL_EVENT_APP_ROLE_ARN;
  if (!production) {
    if (roleArn) throw new Error('EMAIL_EVENT_IDENTITY_FORBIDDEN');
    return {};
  }
  if (roleArn !== PRODUCTION_EMAIL_APP_ROLE_ARN)
    throw new Error('EMAIL_EVENT_IDENTITY_NOT_CONFIGURED');
  return {
    region: 'ap-northeast-1',
    credentials: provider({ roleArn, durationSeconds: 900, clientConfig: { region: 'ap-northeast-1' } }),
  };
};
