import { EmailActionForm } from '@/components/email-action-form';

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = '' } = await searchParams;
  return (
    <main className="wrap max-w-xl py-20">
      <p className="eyebrow">Account security</p>
      <h1 className="serif mt-4 text-4xl">メールアドレスの確認</h1>
      {token ? (
        <EmailActionForm action="verify" token={token} />
      ) : (
        <p className="mt-6 text-sm">確認リンクが正しくありません。</p>
      )}
    </main>
  );
}
