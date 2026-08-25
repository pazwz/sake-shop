import { siteConfig } from '@/config/site';

type BrandLogoProps = {
  variant?: 'header' | 'footer' | 'loading' | 'admin';
  showLocation?: boolean;
};

export function BrandLogo({
  variant = 'header',
  showLocation = false,
}: BrandLogoProps) {
  return (
    <span
      className={`brand-logo brand-logo-${variant}`}
      aria-label={siteConfig.brandName}
    >
      <span className="brand-logo-name" aria-hidden="true">
        {siteConfig.brandName}
      </span>
      {showLocation ? (
        <span className="brand-logo-location" aria-hidden="true">
          {siteConfig.locationLabel}
        </span>
      ) : null}
    </span>
  );
}
