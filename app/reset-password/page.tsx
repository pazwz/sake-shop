import { EmailActionForm } from '@/components/email-action-form';

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = '' } = await searchParams;
  return (
    <main className="wrap max-w-xl py-20">
      <p className="eyebrow">Account security</p>
      <h1 className="serif mt-4 text-4xl">パスワード再設定</h1>
      {token ? (
        <EmailActionForm action="reset" token={token} />
      ) : (
        <p className="mt-6 text-sm">再設定リンクが正しくありません。</p>
      )}
    </main>
  );
}
