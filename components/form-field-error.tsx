export function FormFieldError({
  id,
  message,
}: {
  id: string;
  message?: string;
}) {
  if (!message) return null;

  return (
    <p id={id} className="mt-2 text-xs text-[#6d2227]" role="alert">
      {message}
    </p>
  );
}
