import {
  PRODUCT_METADATA_FIELD_LABEL,
  PRODUCT_METADATA_STATUS,
  type ProductMetadataCompleteness,
} from '@/types/product-metadata-completeness';

const missingSummary = (
  fields: ProductMetadataCompleteness['missingFields'],
) => {
  const labels = fields.map((field) => PRODUCT_METADATA_FIELD_LABEL[field]);
  if (labels.length <= 2) return labels.join('・');
  return `${labels.slice(0, 2).join('・')} ほか${labels.length - 2}件`;
};

export function ProductMetadataCompletenessCell({
  completeness,
  isPublished,
}: {
  completeness: ProductMetadataCompleteness;
  isPublished: boolean;
}) {
  if (!isPublished)
    return <span className="text-xs text-stone-400">公開中商品のみ判定</span>;

  const fullMissingLabels = completeness.missingFields
    .map((field) => PRODUCT_METADATA_FIELD_LABEL[field])
    .join('・');
  if (completeness.status === PRODUCT_METADATA_STATUS.COMPLETE) {
    return (
      <span className="inline-flex whitespace-nowrap rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-800">
        ✓ 基本情報OK
      </span>
    );
  }
  if (completeness.status === PRODUCT_METADATA_STATUS.OPTIONAL_INCOMPLETE) {
    return (
      <div title={fullMissingLabels}>
        <span className="inline-flex whitespace-nowrap rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-900">
          △ 情報追加可
        </span>
        <p className="mt-1 max-w-44 text-[10px] leading-4 text-amber-900">
          テイスティング未設定
        </p>
      </div>
    );
  }
  return (
    <div title={fullMissingLabels}>
      <span className="inline-flex whitespace-nowrap rounded-full bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-800">
        ! 要確認
      </span>
      <p className="mt-1 max-w-44 text-[10px] leading-4 text-rose-800">
        {missingSummary(completeness.missingCoreFields)}が未設定
      </p>
    </div>
  );
}

export function ProductMetadataCompletenessNotice({
  completeness,
}: {
  completeness: ProductMetadataCompleteness;
}) {
  if (completeness.status === PRODUCT_METADATA_STATUS.COMPLETE) {
    return (
      <div className="mt-8 border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        ✓ 基本情報は揃っています。
      </div>
    );
  }
  if (completeness.status === PRODUCT_METADATA_STATUS.OPTIONAL_INCOMPLETE) {
    return (
      <div className="mt-8 border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        △ テイスティングが未設定です。公開は継続できます。
      </div>
    );
  }
  return (
    <div className="mt-8 border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
      <p className="font-semibold">! 未設定項目があります</p>
      <ul className="mt-2 list-disc pl-5 text-xs leading-5">
        {completeness.missingCoreFields.map((field) => (
          <li key={field}>{PRODUCT_METADATA_FIELD_LABEL[field]}</li>
        ))}
      </ul>
      {completeness.missingOptionalFields.length ? (
        <p className="mt-2 text-xs">テイスティングは任意項目です。</p>
      ) : null}
    </div>
  );
}
