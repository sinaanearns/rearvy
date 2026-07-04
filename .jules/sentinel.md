# Sentinel Journal

## 2025-05-14 - [Audit Log Security]
**Vulnerability:** Identified potential IDOR (Insecure Direct Object Reference) and lack of immutability in Firestore rules for `audit_logs`. The `allow write` rule was overly permissive.
**Learning:** High-integrity logs must be immutable and restricted to the authenticated user's ID to prevent tampering.
**Prevention:** Use `allow create` with UID verification and `allow update, delete: if false` for audit collections.

## 2025-05-14 - [Knowledge Document Security]
**Vulnerability:** Identified potential IDOR in `knowledge_documents` and `knowledge_chunks` where `allow write` only checked `request.resource.data.user_id`, allowing any user to overwrite another's data.
**Learning:** Shorthand `write` rules often miss checking the existing `resource.data` on updates.
**Prevention:** Split `write` into `create` and `update/delete` to ensure ownership of existing resources is verified.
