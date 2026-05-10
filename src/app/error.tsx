'use client';

/**
 * App Router error boundary for pages
 * Catches and handles errors from page.tsx and nested layouts
 */
export default function ErrorBoundary({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  // Log error details server-side (console.error is streamed to server logs)
  console.error('Page error:', { message: error.message, stack: error.stack });

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', textAlign: 'center' }}>
      <h1>Something went wrong</h1>
      <p>An unexpected error occurred. Please try again later.</p>
      <button
        onClick={() => reset()}
        style={{
          padding: '8px 16px',
          backgroundColor: '#0070f3',
          color: 'white',
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer',
        }}
      >
        Try again
      </button>
    </div>
  );
}
