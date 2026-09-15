export default function AccountLoading() {
  return (
    <main className="wrap animate-pulse py-14 md:py-20" aria-busy="true">
      <div className="h-3 w-24 bg-stone-200" />
      <div className="mt-5 h-12 w-56 bg-stone-200" />
      <div className="mt-10 h-48 max-w-2xl bg-stone-100" />
    </main>
  );
}
