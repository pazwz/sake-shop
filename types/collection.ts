export interface CollectionProductCandidate {
  id: string;
  name: string;
  productCode: string;
  slug: string;
  producer: string | null;
  isActive: boolean;
  isEcAvailable: boolean;
  isEligible: boolean;
  category: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface CollectionProductCandidateResult {
  items: CollectionProductCandidate[];
  categories: Array<{ id: string; name: string }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
