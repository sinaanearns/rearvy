/**
 * Custom 404 page for website app
 */
export default function NotFound() {
  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', textAlign: 'center' }}>
      <h1>Page Not Found</h1>
      <p>The page you're looking for doesn't exist.</p>
      <a
        href="/"
        style={{
          display: 'inline-block',
          marginTop: 16,
          padding: '8px 16px',
          backgroundColor: '#0070f3',
          color: 'white',
          textDecoration: 'none',
          borderRadius: 4,
        }}
      >
        Return Home
      </a>
    </div>
  );
}
