import 'server-only';

import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

type AwsS3Configuration = {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  cloudFrontDomain: string;
};

let s3Client: S3Client | null = null;

const requireEnvironmentVariable = (
  name: string,
  value: string | undefined,
) => {
  if (!value) throw new Error(`${name} is required for AWS S3 storage.`);
  return value;
};

const getConfiguration = (): AwsS3Configuration => ({
  region: requireEnvironmentVariable('AWS_REGION', process.env.AWS_REGION),
  accessKeyId: requireEnvironmentVariable(
    'AWS_ACCESS_KEY_ID',
    process.env.AWS_ACCESS_KEY_ID,
  ),
  secretAccessKey: requireEnvironmentVariable(
    'AWS_SECRET_ACCESS_KEY',
    process.env.AWS_SECRET_ACCESS_KEY,
  ),
  bucket: requireEnvironmentVariable(
    'AWS_S3_BUCKET',
    process.env.AWS_S3_BUCKET,
  ),
  cloudFrontDomain: requireEnvironmentVariable(
    'AWS_CLOUDFRONT_DOMAIN',
    process.env.AWS_CLOUDFRONT_DOMAIN,
  ),
});

const getS3Client = (configuration: AwsS3Configuration) => {
  s3Client ??= new S3Client({
    region: configuration.region,
    credentials: {
      accessKeyId: configuration.accessKeyId,
      secretAccessKey: configuration.secretAccessKey,
    },
  });
  return s3Client;
};

const normalizeKey = (key: string) => {
  const normalized = key.replace(/^\/+/, '');
  if (!normalized) throw new Error('An S3 object key is required.');
  return normalized;
};

const getCloudFrontUrl = (domain: string, key: string) => {
  const normalizedDomain = domain
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  return `https://${normalizedDomain}/${encodedKey}`;
};

export const uploadFile = async (
  buffer: Buffer,
  key: string,
  contentType: string,
): Promise<string> => {
  const configuration = getConfiguration();
  const normalizedKey = normalizeKey(key);
  await getS3Client(configuration).send(
    new PutObjectCommand({
      Bucket: configuration.bucket,
      Key: normalizedKey,
      Body: buffer,
      ContentType: contentType,
    }),
  );
  return getCloudFrontUrl(configuration.cloudFrontDomain, normalizedKey);
};

export const deleteFile = async (key: string): Promise<void> => {
  const configuration = getConfiguration();
  await getS3Client(configuration).send(
    new DeleteObjectCommand({
      Bucket: configuration.bucket,
      Key: normalizeKey(key),
    }),
  );
};
