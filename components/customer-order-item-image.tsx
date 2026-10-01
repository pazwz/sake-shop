'use client';

import { useState } from 'react';

export function CustomerOrderItemImage({
  imageUrl,
  alt,
}: {
  imageUrl: string | null;
  alt: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return (
    <div className="flex h-24 w-24 shrink-0 items-center justify-center bg-[var(--soft)] sm:h-32 sm:w-32">
      {imageUrl && failedUrl !== imageUrl ? (
        // Historical URLs can be external; preserve them without optimization.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={alt}
          width={128}
          height={128}
          className="h-full w-full object-contain p-2"
          onError={() => setFailedUrl(imageUrl)}
        />
      ) : (
        <span className="px-2 text-center text-xs text-black/50">画像なし</span>
      )}
    </div>
  );
}
