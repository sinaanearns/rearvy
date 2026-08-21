---
name: Connector / Integration Request
about: Propose a new SaaS platform or API integration for Rearvy agents
title: '[CONNECTOR] '
labels: ['connector', 'integration']
assignees: ''
---

### Platform / Service Name
e.g. Linear, Jira, QuickBooks, Snowflake, Shopify, HubSpot

### Platform Website & API Documentation
- Website: `https://...`
- API Docs: `https://...`

### Key Capabilities Needed
What actions should Rearvy autonomous agents be able to perform with this connector?
- [ ] Read data (e.g. query issues, fetch invoices, check inventory)
- [ ] Write / Create data (e.g. draft deal, post invoice) — *Requires user approval*
- [ ] Webhook triggers (e.g. on new lead, on payment success)

### Sample MCP / Connector Schema (Optional)
If you have a draft `rearvy.manifest.json` or JSON schema, please paste it below:

```json
{
  "id": "example-service",
  "displayName": "Example Service",
  "capabilities": []
}
```
