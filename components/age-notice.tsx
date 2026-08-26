const AGE_NOTICE_TEXT = '20歳未満の者の飲酒は法律で禁止されています。';

export function AgeNotice({ className = '' }: { className?: string }) {
  return (
    <p className={`text-[10px] leading-5 text-stone-500 ${className}`}>
      {AGE_NOTICE_TEXT}
    </p>
  );
}
