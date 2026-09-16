import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Prisma Client's Node.js PostgreSQL runtime only loads `runtime/library.js`
  // and the generated platform query engine. Keep those files traced, while
  // excluding debug maps and runtimes for Edge/WASM/other database engines.
  // This prevents every Vercel Node Function from storing unused Prisma assets.
  outputFileTracingExcludes: {
    '/*': [
      './node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/client/**/*.map',
      './node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/client/runtime/binary.*',
      './node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/client/runtime/edge.*',
      './node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/client/runtime/react-native.*',
      './node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/client/runtime/wasm-compiler-edge.*',
      './node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/client/runtime/query_engine_bg.*',
      './node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/client/runtime/query_compiler_bg.*',
      './node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/query_engine_bg.*',
    ],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'diowj5taor0dy.cloudfront.net',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
