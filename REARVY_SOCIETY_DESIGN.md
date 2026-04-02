# Rearvy Society - System Design Document

## 1. DATABASE SCHEMA

### New Collections (Firestore)

```typescript
// Core project & team management
- societies/
  - {societyId}/
    - name: string
    - description: string
    - category: "tech" | "ecommerce" | "saas" | "content" | "other"
    - status: "ideation" | "approved" | "active" | "completed" | "archived"
    - founder_id: string
    - created_at: Timestamp
    - updated_at: Timestamp
    - total_ownership: number (sum of all member ownership % - should equal 100)
    - total_revenue?: number
    - stage: "formation" | "building" | "scaling" | "exiting"

- society_members/
  - {memberId} (doc: societyId_userId)
    - society_id: string (FK)
    - user_id: string (FK)
    - status: "invited" | "pending_acceptance" | "active" | "inactive" | "removed"
    - role: "founder" | "member"
    - ownership_percent: number (0-100, can be fractional)
    - equity_vesting: {
        cliff_months: number (0-12)
        vesting_months: number (12-48)
        vested_percent: number (0-100)
        vesting_start_date: Timestamp
      }
    - contribution_score: number (0-100, used for performance tracking)
    - join_date: Timestamp
    - updated_at: Timestamp

- society_roles/
  - {roleId} (doc: societyId_roleId)
    - society_id: string (FK)
    - user_id: string (FK)
    - title: string ("CEO", "CTO", "Marketing Manager", etc)
    - description: string
    - responsibilities: string[]
    - assigned_at: Timestamp
    - updated_at: Timestamp

- society_chats/ (Default system chats + direct messaging)
  - {chatId}
    - society_id: string | null (null if direct message)
    - chat_type: "system_general" | "system_important" | "system_announcements" | "direct" | "group"
    - name: string (display name for users)
    - description: string | null
    - is_pinned: boolean
    - participant_ids: string[] (members who can access)
    - created_by: string
    - created_at: Timestamp
    - updated_at: Timestamp
    - last_message_at: Timestamp

- society_messages/ (extend existing messages table)
  - {messageId}
    - chat_id: string (FK)
    - sender_id: string
    - content: string
    - rich_content: {
        type: "text" | "milestone" | "revenue_update" | "file"
        data: Record<string, any>
      }
    - mentions: string[] (user_ids mentioned)
    - reactions: Record<string, string[]> (emoji -> [user_ids])
    - edited_at: Timestamp | null
    - created_at: Timestamp

- chat_requests/
  - {requestId} (doc: requesterId_recipientId)
    - from_user_id: string
    - to_user_id: string
    - status: "pending" | "accepted" | "rejected" | "blocked"
    - message: string | null
    - created_at: Timestamp
    - responded_at: Timestamp | null

- society_contributions/ (Track work & contributions)
  - {contributionId}
    - society_id: string (FK)
    - contributor_id: string (FK)
    - title: string
    - description: string
    - contribution_type: "code" | "marketing" | "sales" | "design" | "strategy" | "operations" | "other"
    - hours_spent: number
    - status: "in_progress" | "completed" | "verified"
    - verified_by: string | null (founder/admin who verified)
    - verified_at: Timestamp | null
    - created_at: Timestamp
    - updated_at: Timestamp

- society_transactions/ (Revenue & distribution)
  - {transactionId}
    - society_id: string (FK)
    - transaction_type: "revenue_in" | "expense" | "distribution" | "adjustment"
    - amount: number
    - currency: string
    - description: string
    - source: string | null (for revenue_in)
    - created_by: string
    - distribution?: {
        allocations: Record<string, number> (userId -> amount)
      }
    - created_at: Timestamp
```

### Key Design Decisions:
1. **Ownership vs Points**: Fractional ownership percentages (e.g., 35.5%) allow precise control
2. **Vesting Schedule**: Equity vests over time to ensure long-term commitment
3. **Contribution Tracking**: Manual approval for early stage (can auto-approve later)
4. **Chat Segregation**: System chats auto-created per user, separate from project chats
5. **Immutable Transactions**: Never update, only add new entries for audit trail

---

## 2. API ENDPOINTS

### Authentication & Profiles
```
POST /api/auth/signup
  - Email/password only
  - Create default system chats
  - Returns: { user_id, token }

POST /api/auth/login
  - Email/password only
  - Returns: { user_id, token }

GET /api/dashboard/profile
  - Get user profile with society memberships

POST /api/dashboard/profile
  - Update profile
```

### Society Management
```
POST /api/societies
  - Create new society
  - Body: { name, description, category }
  - Auto-add creator as founder with 100% ownership
  - Returns: societyId

GET /api/societies
  - List all societies user is member/invited to
  - Returns: { societies: Society[] }

GET /api/societies/:societyId
  - Full society details with member list
  - Include: members, roles, ownership structure, recent activity

PATCH /api/societies/:societyId
  - Update society details (name, description, status)
  - Only founder can change status

GET /api/societies/:societyId/members
  - List members with roles & ownership
  - Returns: { members: SocietyMember[] }

POST /api/societies/:societyId/members
  - Invite user by email
  - Body: { email, initial_ownership_percent }
  - Returns: inviteCode for acceptance link

POST /api/societies/:societyId/members/:userId/accept-invite
  - User accepts membership
  - Auto-creates direct chat between founder & new member
  - Returns: { access_token }

PATCH /api/societies/:societyId/members/:userId
  - Update member ownership (founder only)
  - Body: { ownership_percent, status }

DELETE /api/societies/:societyId/members/:userId
  - Remove member (founder only)
  - Freeze their vesting

POST /api/societies/:societyId/roles
  - Assign role to member
  - Body: { user_id, title, description, responsibilities }

PATCH /api/societies/:societyId/roles/:roleId
  - Update role details

GET /api/societies/:societyId/analytics
  - Ownership distribution, contribution metrics, revenue
  - Returns: { ownership_chart, contribution_leaderboard, revenue_by_member }
```

### Contributions
```
POST /api/societies/:societyId/contributions
  - Log contribution
  - Body: { title, description, contribution_type, hours_spent }
  - Returns: contributionId

PATCH /api/societies/:societyId/contributions/:contributionId
  - Verify contribution (founder only)
  - Body: { status: "verified" }

GET /api/societies/:societyId/contributions
  - List contributions with filters
  - Query: ?status=verified&contributor_id=:userId
```

### Chat System
```
GET /api/societies/:societyId/chats
  - List all chats (system + direct + group)
  - Include: unread counts, last message preview

POST /api/societies/:societyId/chats
  - Create group chat (members only)
  - Body: { name, participant_ids }

GET /api/societies/:societyId/chats/:chatId
  - Get chat details + paginated messages
  - Query: ?limit=50&offset=0

POST /api/societies/:societyId/chats/:chatId/messages
  - Send message to society chat
  - Body: { content, mentions?, reactions? }

POST /api/chat-requests
  - Request direct chat with another user
  - Body: { to_user_id, message? }
  - Sender must be in same society

POST /api/chat-requests/:requestId/accept
  - Accept direct chat request
  - Auto-creates direct chat

POST /api/chat-requests/:requestId/reject
  - Reject request

GET /api/chats/direct/:userId
  - Get direct chat (if exists)
  - Returns: { chatId } or null

POST /api/chats/direct/:userId/messages
  - Send direct message
  - Body: { content }
```

### Transactions & Revenue
```
POST /api/societies/:societyId/transactions
  - Log transaction (revenue/expense/distribution)
  - Body: { transaction_type, amount, description, source? }
  - Only founder can create

GET /api/societies/:societyId/transactions
  - Audit log of all transactions
  - Query: ?limit=100&offset=0

POST /api/societies/:societyId/distribute-revenue
  - Distribute revenue to members based on ownership
  - Automated calculation based on current ownership %
  - Body: { revenue_amount, description }
  - Creates individual transactions per member
```

---

## 3. UI/UX FLOW

### Page Structure
```
/society
  ├── /societies (discovery/list)
  │   └── Create society button → /society/new
  ├── /society/:societyId
  │   ├── Overview (dashboard)
  │   │   ├── Society header (name, status, members count)
  │   │   ├── Ownership breakdown chart (pie chart)
  │   │   ├── Recent contributions feed
  │   │   ├── Revenue & distribution summary
  │   │   └── Quick actions (invite, roles, chat)
  │   │
  │   ├── /members
  │   │   ├── Member list with roles & ownership
  │   │   ├── Invite modal
  │   │   ├── Member detail → edit ownership/role (founder)
  │   │   └── Contribution history per member
  │   │
  │   ├── /contributions
  │   │   ├── All contributions (sortable, filterable)
  │   │   ├── "Log contribution" button
  │   │   ├── Contribution detail → edit/verify
  │   │   └── Leaderboard: hours/count by member
  │   │
  │   ├── /financials
  │   │   ├── Revenue log (all transactions)
  │   │   ├── Distribution history
  │   │   ├── Member earnings breakdown
  │   │   └── "Distribute revenue" button (founder)
  │   │
  │   ├── /chats
  │   │   ├── System chats (General, Important)
  │   │   ├── Group chats
  │   │   ├── Direct messages section
  │   │   ├── Chat interface (messages, input, reactions)
  │   │   └── Mention & notification system
  │   │
  │   └── /settings (founder only)
  │       ├── Society name/description
  │       ├── Status/visibility
  │       └── Member management

/chats
  ├── Direct messages (outside societies)
  └── Chat request notifications
```

### Key UI Components
1. **Ownership Pie Chart** - Real-time ownership split visualization
2. **Contribution Card** - Shows contributor, hours, status, verify button
3. **Member Card** - Avatar, role, ownership %, earnings to date
4. **Transaction List** - With distribution breakdown inline
5. **Chat Interface** - Message reactions, mentions, rich media support
6. **Invite Modal** - Email input, initial ownership suggestion, copy invite link

---

## 4. SECURITY & MISUSE PREVENTION

### Access Control
```typescript
// Role-based access matrix
const PERMISSIONS = {
  founder_only: [
    "update_society_details",
    "change_member_ownership",
    "remove_member",
    "verify_contributions",
    "distribute_revenue",
    "change_society_status",
  ],
  all_members: [
    "view_society_details",
    "log_contributions",
    "send_messages",
    "view_financials_summary",
  ],
  public: [
    "view_society_info", // Limited public profile
  ],
};

// Implement on all API endpoints
async function requireSocietyAccess(societyId: string, userId: string, permission: string) {
  const member = await db.collection('society_members').doc(`${societyId}_${userId}`).get();

  if (!member.exists || member.data().status !== 'active') {
    throw new Error('Access denied');
  }

  if (PERMISSIONS[permission].includes('founder_only') && member.data().role !== 'founder') {
    throw new Error('Founder access required');
  }
}
```

### Specific Safeguards

1. **Ownership Integrity**
   - Total ownership must = 100% before society goes live
   - Ownership changes require audit log entry
   - Support override (admin only) for edge cases

2. **Fraud Prevention**
   - Contribution verification before earnings
   - Contribution limits per user per day (e.g., max 16 hours)
   - Founder review of unusual patterns
   - Automatic flag if member logs >100 hours/week

3. **Chat Abuse**
   - Rate limiting: 50 messages/minute per user
   - Block spam: limit repeated identical messages
   - Founder can delete/edit messages in society chats
   - Direct message blocking (users can block)
   - No external links in society chats (founders whitelist specific domains)

4. **Revenue Misuse**
   - Only actual revenue can be logged (require source/proof)
   - Founder confirms all revenue entries
   - No negative distributions (can't take money from members)
   - All transactions immutable (no edits, only corrections via new adjustment transaction)

5. **Data Isolation**
   - Society members can only see own direct message history
   - Revenue details only visible to founder (members see own earnings only)
   - Contribution details redacted except hours logged (not descriptions)

---

## 5. BACKEND STRUCTURE

### File Organization
```
/src
  /app
    /api
      /societies
        /route.ts (GET list, POST create)
        /[societyId]
          /route.ts (GET details, PATCH update)
          /members
            /route.ts (GET list, POST invite)
            /[userId]
              /route.ts (PATCH update, DELETE remove)
              /accept-invite/route.ts
          /contributions
            /route.ts (GET list, POST create)
            /[contributionId]/route.ts (PATCH verify)
          /chats
            /route.ts (GET list, POST create)
            /[chatId]
              /route.ts
              /messages/route.ts
          /transactions
            /route.ts (GET list, POST create)
            /distribute/route.ts
          /analytics/route.ts
      /chat-requests/route.ts
      /chats/direct/[userId]/route.ts

  /lib
    /societies (business logic)
      /service.ts (CreateSociety, InviteMember, VerifyContribution, etc)
      /validation.ts (Zod schemas)
      /permissions.ts (Access control)
    /chat (chat-specific logic)
      /service.ts
```

### Core Service Layer (DDD Pattern)
```typescript
// /lib/societies/service.ts

class SocietyService {
  async createSociety(input: CreateSocietyInput): Promise<Society> {
    // Validate input
    // Create society doc
    // Add founder as member with 100% ownership
    // Create default system chats (General, Important)
    // Log audit entry
    // Return society
  }

  async inviteMember(societyId: string, email: string, ownership: number): Promise<InviteLink> {
    // Validate ownership + existing total ≤ 100%
    // Check email exists in system
    // Create invitation (pending status)
    // Generate unique invite code
    // Send email notification
    // Return invite link
  }

  async acceptInvite(societyId: string, userId: string): Promise<void> {
    // Mark invitation as accepted
    // Update member status to active
    // Create default direct chat with founder
    // Log audit entry
  }

  async logContribution(contributionData: ContributionInput): Promise<Contribution> {
    // Validate contributor is active member
    // Check daily hour limit not exceeded
    // Create contribution record (status: pending)
    // Notify founder
    // Return contribution
  }

  async verifyContribution(societyId: string, contributionId: string): Promise<void> {
    // Check caller is founder
    // Update contribution status to verified
    // Update contributor's score
    // Log audit entry
  }

  async distributeRevenue(societyId: string, amount: number): Promise<Transaction[]> {
    // Get all active members with current ownership %
    // Calculate distribution per member
    // Create individual transactions per member
    // Create summary transaction
    // Return transactions
  }
}

export const societyService = new SocietyService();
```

### Error Handling
```typescript
// Custom error classes
class SocietyError extends Error {
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

// Usage in APIs
try {
  await societyService.createSociety(data);
} catch (error) {
  if (error instanceof SocietyError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  // Log unexpected errors
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
```

---

## 6. SCALABILITY CONSIDERATIONS

### Database Optimization
1. **Indexing** (Firestore)
   ```
   societies: [creator_id, status, created_at]
   society_members: [society_id, status, ownership_percent]
   contributions: [society_id, status, created_at]
   transactions: [society_id, created_at]
   ```

2. **Denormalization** (to avoid N+1 queries)
   ```typescript
   // On society doc:
   {
     member_count: number,
     total_revenue: number,
     last_activity_at: Timestamp,
   }

   // On member doc:
   {
     user_email: string,
     user_name: string,
     user_avatar: string,
     earnings_to_date: number,
   }
   ```

3. **Collection Sharding** (for high-volume chats)
   - If single society gets 10k+ messages:
   - Split messages into subcolls: `society_chats/:chatId/messages_0`, `_1`, etc
   - Shard key: `messageId % shardCount`

### Performance
- Cache society details (5min TTL)
- Paginate contributions/transactions (50 per page)
- Lazy-load member profiles
- Real-time updates via Firestore listeners (for chat)
- Batch transaction reads (get all members in one call)

### Limits to Document
- Max 1MB per document (watch member earnings history)
- Max 500 reads/write per transaction
- Implement pagination for any list with >100 items

---

## 7. CHAT SYSTEM ARCHITECTURE

### System Chat Initialization
```typescript
// When user signs up
async function initializeSystemChats(userId: string) {
  // Create "Rearvy Chat" (exists for all users)
  await createSystemChat({
    user_id: userId,
    chat_type: 'system_general',
    name: 'Rearvy Chat',
    description: 'Platform updates and announcements',
  });

  // Seed with welcome message
  await sendSystemMessage(userId, 'chat_rearvy_general',
    content: "Welcome to Rearvy! You're now part of our community.",
  );
}

// When society chat is created
async function initializeSocietyChatChannels(societyId: string) {
  const members = await getSocietyMembers(societyId);

  // Create "Society General" chat visible to all members
  const generalChat = await createChat({
    society_id: societyId,
    chat_type: 'system_general',
    name: `${societyName} - General`,
    participant_ids: members.map(m => m.user_id),
  });

  // Create "Important" chat (announcements only)
  const importantChat = await createChat({
    society_id: societyId,
    chat_type: 'system_important',
    name: `${societyName} - Important`,
    participant_ids: members.map(m => m.user_id),
  });

  // Seed announcement
  await sendSystemMessage(
    founder_id,
    importantChat.id,
    "Welcome to the society! Check #general for team coordination.",
  );
}
```

### Direct Messaging Flow
```
User A → sends chat request → User B
         (request in pending state)
              ↓
User B receives notification
         (requests appear in dedicated UI section)
         ↓ (accepts)
         ↓ (creates direct chat)
         ↓
Both can now message (auto-delete request)
```

### Real-Time Updates
```typescript
// Client-side (React hook)
import { onSnapshot } from 'firebase/firestore';

export function useSocietyChatMessages(chatId: string) {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(
        collection(db, 'society_messages'),
        where('chat_id', '==', chatId),
        orderBy('created_at', 'asc'),
        limit(50)
      ),
      (snapshot) => setMessages(snapshot.docs.map(doc => doc.data()))
    );

    return unsubscribe;
  }, [chatId]);

  return messages;
}
```

---

## 8. IMPLEMENTATION ROADMAP

### Phase 1 (Week 1-2): Core Foundation
- [ ] Database schema setup (Firestore collections)
- [ ] Society CRUD APIs (create, get, update)
- [ ] Member management (invite, accept)
- [ ] Basic UI (society list, detail page)

### Phase 2 (Week 3): Chat System
- [ ] Initialize system chats (auto-create Rearvy Chat, General, Important)
- [ ] Chat API (send, list messages)
- [ ] Direct messaging with chat requests
- [ ] Chat UI (message list, input, send)

### Phase 3 (Week 4): Contributions & Revenue
- [ ] Contribution logging & verification
- [ ] Revenue transaction API
- [ ] Distribution logic
- [ ] Financials dashboard

### Phase 4 (Week 5): Polish & Security
- [ ] Access control layer
- [ ] Rate limiting
- [ ] Contribution limit enforcement
- [ ] Fraud detection (anomalies)
- [ ] Audit logging

---

## 9. TESTING STRATEGY

### Key Test Scenarios
```typescript
// Ownership integrity
describe('Society Ownership', () => {
  it('should reject invitation if total ownership > 100%', async () => {
    // Create society
    // Add member with 60% ownership
    // Try to invite with 50% → should fail
  });

  it('should allow removal and reassignment', async () => {
    // Create society with 3 members (40%, 35%, 25%)
    // Remove member with 40%
    // Verify ownership updates to 60% (need reassignment)
  });
});

// Chat access
describe('Society Chat Access', () => {
  it('should create system chats on society creation', async () => {
    const society = await createSociety();
    const chats = await getChatsBySociety(society.id);
    expect(chats.length).toBeGreaterThanOrEqual(2);
  });

  it('should deny non-member access to society chats', async () => {
    const response = await getMessages(societyId, chatId, { userId: outsider });
    expect(response.status).toBe(403);
  });
});

// Contribution verification
describe('Contributions', () => {
  it('should flag if member logs >16 hours in one day', async () => {
    // Log 8 hours AM
    // Log 9 hours PM
    // Verify flagged as suspicious
  });
});
```

---

## 10. CONFIGURATION & ENV VARS

```bash
# .env.local
NEXT_PUBLIC_SOCIETY_ENABLED=true
SOCIETY_CHAT_RATE_LIMIT=50 # messages per minute
SOCIETY_CONTRIBUTION_DAILY_LIMIT=16 # hours
SOCIETY_CONTRIBUTION_WEEKLY_LIMIT=100 # hours (flag if exceeded)
SOCIETY_FRAUD_CHECK_ENABLED=true
```

---

## NEXT STEPS

1. Create Firestore collections with security rules
2. Implement database schema validation (Zod schemas)
3. Build API endpoints (start with societies CRUD)
4. Create UI pages (use existing shadcn components)
5. Implement chat system (leverage existing chat structure)
6. Add access control & validation throughout

This design prioritizes **execution over perfection**, uses existing patterns (Firebase, Next.js API routes), and prevents common misuse through smart defaults and founder control.
