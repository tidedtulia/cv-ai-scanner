/** Friendly message when the backend can't be reached — the page still renders. */
export function ErrorNotice({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {message}
    </p>
  );
}
