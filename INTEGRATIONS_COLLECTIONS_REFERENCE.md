# Integrations Firestore Collections Reference

This document lists the Firestore collections and document shapes used by Excel, Instagram, Gmail, and Facebook integrations.

## 1) Shared Integration Collection

Collection: integrations

Each provider creates or updates one document in integrations with these common fields:

- user_id
- provider
- provider_account_id
- provider_account_name
- access_token_enc
- token_iv
- scopes
- token_expires_at
- status
- sync_cursor
- updated_at
- created_at (on first insert)
- refresh_token_enc (provider-dependent)
- last_synced_at (after sync)

### Excel integration doc (provider = excel)

- provider_account_id: Microsoft profile id
- provider_account_name: Microsoft display name or mail
- refresh_token_enc: present
- sync_cursor keys:

  - refresh_iv
  - source_type = microsoft_graph
  - oauth_redirect_uri
  - workbook_item_id (after sync)
  - workbook_name (after sync)
  - workbook_web_url (after sync)
  - sheet_count (after sync)
  - total_rows (after sync)
  - imported_at (after sync)

### Instagram integration doc (provider = instagram)

- provider_account_id: Instagram business account id
- provider_account_name: @username
- refresh_token_enc: not used in current flow
- sync_cursor keys:

  - ig_user_id

### Gmail integration doc (provider = gmail)

- doc id pattern: gmail_{user_id}
- provider_account_id: Google profile id or email
- provider_account_name: account email
- refresh_token_enc: present
- sync_cursor keys:

  - refresh_iv

### Facebook integration doc (provider = facebook)

- provider_account_id: first page id
- provider_account_name: first page name
- refresh_token_enc: not used in current flow
- sync_cursor keys:

  - page_ids (array of page ids)

## 2) Excel Collections

### Collection: excel_workbooks

Doc id pattern: {integration_id}

Fields:

- id
- user_id
- integration_id
- workbook_name
- source_file_name
- source_file_path (null for Graph-backed sync)
- sheet_count
- total_rows
- sheets (array of sheet summary objects)
- synced_at
- created_at
- updated_at

Sheet summary object fields:

- name
- rowCount
- importedRowCount
- columnCount
- columns
- previewRows
- truncated

### Collection: excel_rows

Doc id pattern: {workbook_id}_{sheet_name}_{row_index} sanitized

Fields:

- user_id
- integration_id
- workbook_id
- sheet_name
- row_index
- data
- search_text
- created_at
- updated_at

## 3) Instagram Collections

### Collection: instagram_accounts

Doc id pattern: {integrationId}__{instagramAccountId} (URL-encoded parts)

Fields:

- user_id
- integration_id
- instagram_id
- username
- name
- profile_picture_url
- biography
- website
- followers_count
- follows_count
- media_count
- synced_at

### Collection: instagram_posts

Doc id pattern: {integrationId}__{postId} (URL-encoded parts)

Fields:

- user_id
- integration_id
- post_id
- caption
- media_type
- media_url
- thumbnail_url
- permalink
- published_at
- like_count
- comments_count
- reach
- impressions
- engagement
- saved
- synced_at

### Collection: instagram_comments

Doc id pattern: {integrationId}__{postId}__{commentId} (URL-encoded parts)

Fields:

- user_id
- integration_id
- post_id
- comment_id
- text
- username
- published_at
- like_count
- synced_at

### Collection: instagram_analytics

Doc id pattern: {integrationId}__{date} (URL-encoded parts)

Fields:

- user_id
- integration_id
- metric_date
- follower_count
- impressions
- reach
- profile_views
- synced_at

## 4) Gmail Collections

### Collection: gmail_threads

Doc id pattern: {integrationId}_{threadExternalId}

Fields:

- id
- user_id
- integration_id
- external_id
- last_message_at
- message_count
- snippet
- created_at
- updated_at

### Collection: gmail_messages

Doc id pattern: {integrationId}_{messageExternalId}

Fields:

- id
- user_id
- integration_id
- external_id
- thread_id
- from
- to (array)
- subject
- snippet
- body_text
- received_at
- category
- intent_signals (array)
- sentiment
- order_id
- customer_id
- processed_at
- created_at
- updated_at

## 5) Facebook Collections

### Collection: facebook_pages

Doc id pattern: {integrationId}__{pageId} (URL-encoded parts)

Fields:

- user_id
- integration_id
- page_id
- name
- category
- about
- description
- link
- picture_url
- fan_count
- followers_count
- synced_at

### Collection: facebook_posts

Doc id pattern: {integrationId}__{postId} (URL-encoded parts)

Fields:

- user_id
- integration_id
- page_id
- post_id
- message
- created_time
- permalink_url
- full_picture
- shares_count
- impressions
- reach
- engagement
- synced_at

### Collection: facebook_comments

Doc id pattern: {integrationId}__{postId}__{commentId} (URL-encoded parts)

Fields:

- user_id
- integration_id
- page_id
- post_id
- comment_id
- text
- author_name
- author_id
- created_time
- like_count
- synced_at

### Collection: facebook_analytics

Doc id pattern: {integrationId}__{pageId}__{date} (URL-encoded parts)

Fields:

- user_id
- integration_id
- page_id
- metric_date
- impressions
- engaged_users
- actions
- synced_at

## 6) Sync Jobs Collection

Collection: integration_sync_jobs

Used by these providers for queued/background sync orchestration:

- excel
- instagram
- gmail
- facebook

Important filter fields used in routes/services:

- user_id
- integration_id
- provider
- status
- created_at
- updated_at

## 7) Quick Query Filters (recommended)

Most provider reads and status counts rely on:

- where user_id == current user
- where integration_id == selected integration (provider data collections)
- orderBy published_at or created_time for post/comment recency queries

## 8) Copy-Paste JSON Templates

Use these templates in Firebase Console when adding or editing documents. Replace placeholder values before saving.

### 8.1 Excel templates

Collection: integrations
Doc: any integration doc id where provider is excel

```json
{
  "user_id": "USER_UID",
  "provider": "excel",
  "provider_account_id": "MICROSOFT_PROFILE_ID",
  "provider_account_name": "user@contoso.com",
  "access_token_enc": "ENCRYPTED_ACCESS_TOKEN",
  "refresh_token_enc": "ENCRYPTED_REFRESH_TOKEN",
  "token_iv": "ACCESS_TOKEN_IV_HEX",
  "scopes": ["offline_access", "User.Read", "Files.Read"],
  "token_expires_at": "2026-04-06T12:00:00.000Z",
  "status": "active",
  "last_synced_at": "2026-04-06T12:10:00.000Z",
  "sync_cursor": {
    "refresh_iv": "REFRESH_TOKEN_IV_HEX",
    "source_type": "microsoft_graph",
    "oauth_redirect_uri": "http://localhost:3000/api/integrations/excel/callback",
    "workbook_item_id": "01ABCDEF1234567890",
    "workbook_name": "Sales.xlsx",
    "workbook_web_url": "https://onedrive.live.com/...",
    "sheet_count": 3,
    "total_rows": 540,
    "imported_at": "2026-04-06T12:10:00.000Z"
  },
  "created_at": "2026-04-06T11:50:00.000Z",
  "updated_at": "2026-04-06T12:10:00.000Z"
}
```

Collection: excel_workbooks
Doc id: INTEGRATION_ID

```json
{
  "id": "INTEGRATION_ID",
  "user_id": "USER_UID",
  "integration_id": "INTEGRATION_ID",
  "workbook_name": "Sales",
  "source_file_name": "Sales.xlsx",
  "source_file_path": null,
  "sheet_count": 3,
  "total_rows": 540,
  "sheets": [
    {
      "name": "Orders",
      "rowCount": 320,
      "importedRowCount": 200,
      "columnCount": 7,
      "columns": ["order_id", "amount", "country"],
      "previewRows": [
        { "order_id": "A-1001", "amount": 49.99, "country": "IN" }
      ],
      "truncated": true
    }
  ],
  "synced_at": "2026-04-06T12:10:00.000Z",
  "created_at": "2026-04-06T11:50:00.000Z",
  "updated_at": "2026-04-06T12:10:00.000Z"
}
```

Collection: excel_rows
Doc id example: INTEGRATION_ID_Orders_0

```json
{
  "user_id": "USER_UID",
  "integration_id": "INTEGRATION_ID",
  "workbook_id": "INTEGRATION_ID",
  "sheet_name": "Orders",
  "row_index": 0,
  "data": {
    "order_id": "A-1001",
    "amount": 49.99,
    "country": "IN"
  },
  "search_text": "A-1001 49.99 IN",
  "created_at": "2026-04-06T12:10:00.000Z",
  "updated_at": "2026-04-06T12:10:00.000Z"
}
```

### 8.2 Instagram templates

Collection: integrations
Doc: any integration doc id where provider is instagram

```json
{
  "user_id": "USER_UID",
  "provider": "instagram",
  "provider_account_id": "17841400000000000",
  "provider_account_name": "@brand_handle",
  "access_token_enc": "ENCRYPTED_ACCESS_TOKEN",
  "token_iv": "ACCESS_TOKEN_IV_HEX",
  "scopes": ["instagram_basic", "instagram_manage_insights", "instagram_manage_comments"],
  "token_expires_at": "2026-05-01T00:00:00.000Z",
  "status": "active",
  "last_synced_at": "2026-04-06T12:10:00.000Z",
  "sync_cursor": {
    "ig_user_id": "17841400000000000"
  },
  "created_at": "2026-04-01T09:00:00.000Z",
  "updated_at": "2026-04-06T12:10:00.000Z"
}
```

Collection: instagram_accounts
Doc id example: INTEGRATION_ID__17841400000000000

```json
{
  "user_id": "USER_UID",
  "integration_id": "INTEGRATION_ID",
  "instagram_id": "17841400000000000",
  "username": "brand_handle",
  "name": "Brand Name",
  "profile_picture_url": "https://...",
  "biography": "Official account",
  "website": "https://example.com",
  "followers_count": 12050,
  "follows_count": 320,
  "media_count": 410,
  "synced_at": "2026-04-06T12:10:00.000Z"
}
```

Collection: instagram_posts
Doc id example: INTEGRATION_ID__POST_ID

```json
{
  "user_id": "USER_UID",
  "integration_id": "INTEGRATION_ID",
  "post_id": "18012345678901234",
  "caption": "New launch",
  "media_type": "IMAGE",
  "media_url": "https://...",
  "thumbnail_url": null,
  "permalink": "https://instagram.com/p/abc123",
  "published_at": "2026-04-05T10:00:00.000Z",
  "like_count": 200,
  "comments_count": 15,
  "reach": 3200,
  "impressions": 4400,
  "engagement": 380,
  "saved": 22,
  "synced_at": "2026-04-06T12:10:00.000Z"
}
```

Collection: instagram_comments
Doc id example: INTEGRATION_ID__POST_ID__COMMENT_ID

```json
{
  "user_id": "USER_UID",
  "integration_id": "INTEGRATION_ID",
  "post_id": "18012345678901234",
  "comment_id": "17999999999999999",
  "text": "Amazing",
  "username": "customer_1",
  "published_at": "2026-04-05T11:00:00.000Z",
  "like_count": 3,
  "synced_at": "2026-04-06T12:10:00.000Z"
}
```

Collection: instagram_analytics
Doc id example: INTEGRATION_ID__2026-04-06

```json
{
  "user_id": "USER_UID",
  "integration_id": "INTEGRATION_ID",
  "metric_date": "2026-04-06",
  "follower_count": 12050,
  "impressions": 4400,
  "reach": 3200,
  "profile_views": 640,
  "synced_at": "2026-04-06T12:10:00.000Z"
}
```

### 8.3 Gmail templates

Collection: integrations
Doc id: gmail_USER_UID

```json
{
  "id": "gmail_USER_UID",
  "user_id": "USER_UID",
  "provider": "gmail",
  "provider_account_id": "GOOGLE_PROFILE_ID_OR_EMAIL",
  "provider_account_name": "user@gmail.com",
  "access_token_enc": "ENCRYPTED_ACCESS_TOKEN",
  "refresh_token_enc": "ENCRYPTED_REFRESH_TOKEN",
  "token_iv": "ACCESS_TOKEN_IV_HEX",
  "scopes": ["https://www.googleapis.com/auth/gmail.readonly"],
  "token_expires_at": "2026-04-06T12:00:00.000Z",
  "status": "active",
  "last_synced_at": "2026-04-06T12:10:00.000Z",
  "sync_cursor": {
    "refresh_iv": "REFRESH_TOKEN_IV_HEX"
  },
  "created_at": "2026-04-01T09:00:00.000Z",
  "updated_at": "2026-04-06T12:10:00.000Z"
}
```

Collection: gmail_threads
Doc id example: INTEGRATION_ID_190f20ab12cd34ef

```json
{
  "id": "INTEGRATION_ID_190f20ab12cd34ef",
  "user_id": "USER_UID",
  "integration_id": "INTEGRATION_ID",
  "external_id": "190f20ab12cd34ef",
  "last_message_at": "2026-04-06T11:58:00.000Z",
  "message_count": 3,
  "snippet": "Can you confirm shipment ETA?",
  "created_at": "2026-04-06T12:10:00.000Z",
  "updated_at": "2026-04-06T12:10:00.000Z"
}
```

Collection: gmail_messages
Doc id example: INTEGRATION_ID_190f20ab12cd34f1

```json
{
  "id": "INTEGRATION_ID_190f20ab12cd34f1",
  "user_id": "USER_UID",
  "integration_id": "INTEGRATION_ID",
  "external_id": "190f20ab12cd34f1",
  "thread_id": "190f20ab12cd34ef",
  "from": "Customer <customer@example.com>",
  "to": ["support@yourbrand.com"],
  "subject": "Order #A-1001 status",
  "snippet": "Can you confirm shipment ETA?",
  "body_text": "Hi team, can you share the ETA for order A-1001?",
  "received_at": "2026-04-06T11:57:00.000Z",
  "category": null,
  "intent_signals": [],
  "sentiment": null,
  "order_id": null,
  "customer_id": null,
  "processed_at": null,
  "created_at": "2026-04-06T12:10:00.000Z",
  "updated_at": "2026-04-06T12:10:00.000Z"
}
```

### 8.4 Facebook templates

Collection: integrations
Doc: any integration doc id where provider is facebook

```json
{
  "user_id": "USER_UID",
  "provider": "facebook",
  "provider_account_id": "123456789012345",
  "provider_account_name": "My Brand Page",
  "access_token_enc": "ENCRYPTED_ACCESS_TOKEN",
  "token_iv": "ACCESS_TOKEN_IV_HEX",
  "scopes": ["pages_show_list", "pages_read_engagement", "read_insights", "pages_manage_posts"],
  "token_expires_at": "2026-05-01T00:00:00.000Z",
  "status": "active",
  "last_synced_at": "2026-04-06T12:10:00.000Z",
  "sync_cursor": {
    "page_ids": ["123456789012345"]
  },
  "created_at": "2026-04-01T09:00:00.000Z",
  "updated_at": "2026-04-06T12:10:00.000Z"
}
```

Collection: facebook_pages
Doc id example: INTEGRATION_ID__123456789012345

```json
{
  "user_id": "USER_UID",
  "integration_id": "INTEGRATION_ID",
  "page_id": "123456789012345",
  "name": "My Brand Page",
  "category": "Product/service",
  "about": "Official page",
  "description": "Brand description",
  "link": "https://facebook.com/mybrand",
  "picture_url": "https://...",
  "fan_count": 25000,
  "followers_count": 26000,
  "synced_at": "2026-04-06T12:10:00.000Z"
}
```

Collection: facebook_posts
Doc id example: INTEGRATION_ID__123456789012345_18000000000000000

```json
{
  "user_id": "USER_UID",
  "integration_id": "INTEGRATION_ID",
  "page_id": "123456789012345",
  "post_id": "123456789012345_18000000000000000",
  "message": "Big launch today",
  "created_time": "2026-04-06T09:30:00.000Z",
  "permalink_url": "https://facebook.com/...",
  "full_picture": "https://...",
  "shares_count": 42,
  "impressions": 10200,
  "reach": 7800,
  "engagement": 1100,
  "synced_at": "2026-04-06T12:10:00.000Z"
}
```

Collection: facebook_comments
Doc id example: INTEGRATION_ID__123456789012345_18000000000000000__9876543210000

```json
{
  "user_id": "USER_UID",
  "integration_id": "INTEGRATION_ID",
  "page_id": "123456789012345",
  "post_id": "123456789012345_18000000000000000",
  "comment_id": "9876543210000",
  "text": "Looks great",
  "author_name": "Customer Name",
  "author_id": "1000123456789",
  "created_time": "2026-04-06T10:10:00.000Z",
  "like_count": 5,
  "synced_at": "2026-04-06T12:10:00.000Z"
}
```

Collection: facebook_analytics
Doc id example: INTEGRATION_ID__123456789012345__2026-04-06

```json
{
  "user_id": "USER_UID",
  "integration_id": "INTEGRATION_ID",
  "page_id": "123456789012345",
  "metric_date": "2026-04-06",
  "impressions": 10200,
  "engaged_users": 1300,
  "actions": 410,
  "synced_at": "2026-04-06T12:10:00.000Z"
}
```
