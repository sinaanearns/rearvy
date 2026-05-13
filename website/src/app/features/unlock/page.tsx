import Link from "next/link";

export default function UnlockFeaturesPage() {
  return (
    <div className="prose max-w-none p-6">
      <h1>Unlock Full Rearvy Features</h1>
      <p>
        Rearvy can run locally with additional features like the Terminal Agent,
        AI automation, and device access. To enable these features, run the
        following commands in your terminal from the project root:
      </p>
      <pre className="rounded-md bg-slate-900 p-4 text-white">
{`cd rearvy2.0
npm run install:all
npm run dev`}
      </pre>
      <h2>What this enables</h2>
      <ul>
        <li>Terminal Agent: run shell commands from within Rearvy</li>
        <li>AI Automation & MCP: automate tasks using AI</li>
        <li>Device access: USB, serial, camera, microphone</li>
        <li>Screen capture and native integrations</li>
      </ul>
      <h2>Troubleshooting</h2>
      <p>
        If Terminal shows "Connecting...", make sure the website shows
        "Ready on localhost:3000" before the desktop app opens. If you see port
        conflicts, free the port or change your environment.
      </p>
      <p>
        For the complete developer guide and advanced troubleshooting, see the
        developer guide in the repo: <Link href="/TERMINAL_SERVER_STARTUP.md">Detailed Startup Guide</Link>.
      </p>
    </div>
  );
}
