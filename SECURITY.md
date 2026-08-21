# Security Policy

Rearvy is an AI Business Operating System that interacts with sensitive business memory, desktop filesystems, and browser automation sessions. We take security, data isolation, and user privacy extremely seriously.

---

## Supported Versions

We actively provide security patches for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 3.x.x   | :white_check_mark: |
| < 3.0   | :x:                |

---

## Reporting a Vulnerability

If you discover a security vulnerability in Rearvy (e.g., prompt injection leading to unauthorized file access, privilege escalation in Electron IPC, credential leakage during browser automation, or SSRF risks), please **do not report it through public GitHub issues**.

Instead, please report vulnerabilities privately:

* **Email**: `security@rearvy.com`
* **GitHub Private Vulnerability Reporting**: Submit via the **Security** tab on our GitHub repository.

### What to Include
To help us triage and resolve the issue quickly, please provide:
1. A clear description of the vulnerability and its potential impact.
2. Step-by-step reproduction instructions or a minimal Proof of Concept (PoC).
3. The affected component (`website`, `desktop-app`, `mcp-bridge`, or `browser-use`).
4. Any potential mitigations or suggested fixes.

---

## Response Timeline

* **Initial Acknowledgement**: Within 48 hours of report submission.
* **Triage & Severity Assessment**: Within 5 business days.
* **Fix & Coordinated Disclosure**: Critical vulnerabilities are prioritized for patch release within 14 days.

---

## Core Security Principles in Rearvy

1. **Zero Unapproved Destructive Actions**: High-risk operations (financial commits, administrative deletions, token rotations) strictly require manual human verification.
2. **Credential Masking**: Automated browser frames and logs automatically strip passwords, cookies, and secret environment tokens.
3. **Tenant & Workspace Isolation**: Multi-tenant RAG searches strictly bound vector indexing to authenticated user/organization scope ($K=5$ bounded citations).
4. **Sandboxed Desktop Access**: Local file modifications in the desktop bridge are constrained to user-approved workspace roots.
