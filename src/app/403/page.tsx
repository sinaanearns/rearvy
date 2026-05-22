import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', textAlign: 'center' }}>
      <h1>Access Denied</h1>
      <p>You do not have permission to view this page.</p>
      <Link
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
      </Link>
    </div>
  );
}
