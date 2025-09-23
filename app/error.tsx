"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div style={{ padding: "20px", textAlign: "center" }}>
      <h1>Something went wrong</h1>
      <p>{error.message}</p>
      <button onClick={() => reset()} style={{ marginTop: "10px" }}>
        Try Again
      </button>
    </div>
  );
}
