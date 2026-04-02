import { db } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/schema";
import {
  getDocById,
  insertDoc,
  updateDocById,
  from as firestoreFrom,
} from "@/lib/firebase/firestore";
import { Timestamp } from "firebase/firestore";
import { nanoid } from "nanoid";
import type {
  CreateSocietyInput,
  UpdateSocietyInput,
  InviteMemberInput,
  UpdateMemberOwnershipInput,
  LogContributionInput,
  DistributeRevenueInput,
} from "./validation";

type CreateSocietyOptions = {
  status?: string;
  stage?: string;
};

/**
 * Custom error class for society operations
 */
export class SocietyError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "SocietyError";
  }
}

/**
 * Society Service - Core business logic
 */
export class SocietyService {
  /**
   * Create a new society
   * - Auto-add creator as founder with 100% ownership
   * - Create default system chats
   */
  async createSociety(
    userId: string,
    input: CreateSocietyInput,
    options: CreateSocietyOptions = {}
  ): Promise<{ id: string; name: string }> {
    const societyId = `society_${nanoid(12)}`;
    const now = Timestamp.now();
    const status = options.status || "ideation";
    const stage = options.stage || "formation";

    // Create society document
    const societyData = {
      id: societyId,
      name: input.name,
      description: input.description || null,
      category: input.category,
      status,
      stage,
      founder_id: userId,
      created_at: now,
      updated_at: now,
      member_count: 1,
      total_revenue: 0,
      total_ownership: 100,
    };

    const { error: createError } = await insertDoc(
      COLLECTIONS.SOCIETIES,
      societyData,
      societyId
    );

    if (createError) {
      throw new SocietyError(
        "CREATE_FAILED",
        `Failed to create society: ${createError.message}`
      );
    }

    // Add founder as member with 100% ownership
    const memberId = `${societyId}_${userId}`;
    const memberData = {
      id: memberId,
      society_id: societyId,
      user_id: userId,
      status: "active",
      role: "founder",
      ownership_percent: 100,
      equity_vesting: {
        cliff_months: 0,
        vesting_months: 0,
        vested_percent: 100,
        vesting_start_date: now,
      },
      contribution_score: 0,
      join_date: now,
      updated_at: now,
    };

    const { error: memberError } = await insertDoc(
      COLLECTIONS.SOCIETY_MEMBERS,
      memberData,
      memberId
    );

    if (memberError) {
      throw new SocietyError(
        "MEMBER_ADD_FAILED",
        `Failed to add founder: ${memberError.message}`
      );
    }

    // Create default system chats
    await this.createDefaultChats(societyId, userId);

    return { id: societyId, name: input.name };
  }

  /**
   * Get society details
   */
  async getSociety(societyId: string): Promise<any> {
    const { data, error } = await getDocById(COLLECTIONS.SOCIETIES, societyId);

    if (error || !data) {
      throw new SocietyError(
        "NOT_FOUND",
        `Society not found: ${societyId}`
      );
    }

    return data;
  }

  /**
   * Update society details
   */
  async updateSociety(
    societyId: string,
    input: UpdateSocietyInput
  ): Promise<void> {
    const society = await this.getSociety(societyId);

    const updateData = {
      ...input,
      updated_at: Timestamp.now(),
    };

    const { error } = await updateDocById(
      COLLECTIONS.SOCIETIES,
      societyId,
      updateData
    );

    if (error) {
      throw new SocietyError(
        "UPDATE_FAILED",
        `Failed to update society: ${error.message}`
      );
    }
  }

  /**
   * List societies for a user (member or invited)
   */
  async listUserSocieties(userId: string): Promise<any[]> {
    try {
      // Get all memberships for user
      const memberships = await firestoreFrom(
        COLLECTIONS.SOCIETY_MEMBERS
      )
        .eq("user_id", userId)
        .execute();

      if (!memberships.length) {
        return [];
      }

      // Get society details for each membership
      const societyIds = [...new Set(memberships.map((m) => m.society_id))];
      const societies = await Promise.all(
        societyIds.map((id) => this.getSociety(id))
      );

      return societies.filter((s) => s !== null);
    } catch (error: any) {
      throw new SocietyError(
        "LIST_FAILED",
        `Failed to list societies: ${error.message}`
      );
    }
  }

  /**
   * Invite member to society
   * - Validate ownership total <= 100%
   * - Create pending member record
   * - Generate invite code
   */
  async inviteMember(
    societyId: string,
    input: InviteMemberInput
  ): Promise<{ invite_code: string; invite_url: string }> {
    const society = await this.getSociety(societyId);

    // Validate total ownership won't exceed 100%
    if (
      society.total_ownership + input.initial_ownership_percent > 100
    ) {
      throw new SocietyError(
        "OWNERSHIP_EXCEEDED",
        `Total ownership would exceed 100%. Current: ${society.total_ownership}%, Requested: ${input.initial_ownership_percent}%`
      );
    }

    // Generate invite code
    const inviteCode = nanoid(16);
    const now = Timestamp.now();

    // Create member record with pending status
    const memberId = `${societyId}_${nanoid(12)}`; // Use temp ID until accepted
    const memberData = {
      id: memberId,
      society_id: societyId,
      email: input.email,
      status: "invited",
      role: "member",
      ownership_percent: input.initial_ownership_percent,
      equity_vesting: {
        cliff_months: 12,
        vesting_months: 48,
        vested_percent: 0,
        vesting_start_date: null,
      },
      contribution_score: 0,
      invite_code: inviteCode,
      invited_at: now,
      updated_at: now,
    };

    const { error } = await insertDoc(
      COLLECTIONS.SOCIETY_MEMBERS,
      memberData,
      memberId
    );

    if (error) {
      throw new SocietyError(
        "INVITE_FAILED",
        `Failed to send invite: ${error.message}`
      );
    }

    // Update society total_ownership
    await updateDocById(COLLECTIONS.SOCIETIES, societyId, {
      total_ownership: society.total_ownership + input.initial_ownership_percent,
      updated_at: Timestamp.now(),
    });

    // In real implementation, send email with invite link
    const inviteUrl = `/society/${societyId}/join?code=${inviteCode}`;

    return { invite_code: inviteCode, invite_url: inviteUrl };
  }

  /**
   * Accept society invite
   */
  async acceptInvite(
    societyId: string,
    userId: string,
    inviteCode: string
  ): Promise<void> {
    // Find pending invite with matching code
    const memberships = await firestoreFrom(COLLECTIONS.SOCIETY_MEMBERS)
      .eq("society_id", societyId)
      .execute();

    const invitation = memberships.find(
      (m) => m.invite_code === inviteCode && m.status === "invited"
    );

    if (!invitation) {
      throw new SocietyError("INVALID_INVITE", "Invite code not found or expired");
    }

    const now = Timestamp.now();

    // Update member record
    await updateDocById(COLLECTIONS.SOCIETY_MEMBERS, invitation.id, {
      user_id: userId,
      status: "pending_acceptance",
      invite_code: null,
      updated_at: now,
    });

    // Create default direct chat with founder
    const society = await this.getSociety(societyId);
    await this.createDirectChat(userId, society.founder_id, societyId);

    // Ensure accepted members are included in the system channels.
    await this.addMemberToSystemChats(societyId, userId);
  }

  /**
   * Get society members
   */
  async getSocietyMembers(societyId: string): Promise<any[]> {
    const members = await firestoreFrom(COLLECTIONS.SOCIETY_MEMBERS)
      .eq("society_id", societyId)
      .execute();

    return members;
  }

  /**
   * Update member ownership (founder only)
   */
  async updateMemberOwnership(
    societyId: string,
    memberId: string,
    input: UpdateMemberOwnershipInput
  ): Promise<void> {
    const society = await this.getSociety(societyId);
    const member = await getDocById(COLLECTIONS.SOCIETY_MEMBERS, memberId);

    if (!member.data) {
      throw new SocietyError("MEMBER_NOT_FOUND", "Member not found");
    }

    const oldOwnership = member.data.ownership_percent;
    const newOwnership = input.ownership_percent ?? oldOwnership;

    // Validate total ownership
    const totalWithoutThis = society.total_ownership - oldOwnership;
    if (totalWithoutThis + newOwnership > 100) {
      throw new SocietyError(
        "OWNERSHIP_EXCEEDED",
        `Total ownership would exceed 100%`
      );
    }

    const updateData = {
      ...input,
      updated_at: Timestamp.now(),
    };

    await updateDocById(COLLECTIONS.SOCIETY_MEMBERS, memberId, updateData);

    // Update society total_ownership
    const newTotal = totalWithoutThis + newOwnership;
    await updateDocById(COLLECTIONS.SOCIETIES, societyId, {
      total_ownership: newTotal,
      updated_at: Timestamp.now(),
    });
  }

  /**
   * Log contribution
   */
  async logContribution(
    societyId: string,
    userId: string,
    input: LogContributionInput
  ): Promise<{ id: string }> {
    // Validate member is active
    const memberId = `${societyId}_${userId}`;
    const member = await getDocById(COLLECTIONS.SOCIETY_MEMBERS, memberId);

    if (!member.data || member.data.status !== "active") {
      throw new SocietyError(
        "NOT_MEMBER",
        "You must be an active member of this society"
      );
    }

    // Check daily hour limit (16 hours)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const contributions = await firestoreFrom(COLLECTIONS.SOCIETY_CONTRIBUTIONS)
      .eq("society_id", societyId)
      .eq("contributor_id", userId)
      .execute();

    const todayHours = contributions
      .filter((c) => {
        const created = new Date(c.created_at);
        return created >= today;
      })
      .reduce((sum, c) => sum + c.hours_spent, 0);

    if (todayHours + input.hours_spent > 16) {
      throw new SocietyError(
        "DAILY_LIMIT_EXCEEDED",
        `Daily limit exceeded. Today: ${todayHours}h, Requested: ${input.hours_spent}h`
      );
    }

    const contributionId = `contrib_${nanoid(12)}`;
    const now = Timestamp.now();

    const contributionData = {
      id: contributionId,
      society_id: societyId,
      contributor_id: userId,
      title: input.title,
      description: input.description || null,
      contribution_type: input.contribution_type,
      hours_spent: input.hours_spent,
      status: "in_progress",
      verified_by: null,
      verified_at: null,
      created_at: now,
      updated_at: now,
    };

    const { error } = await insertDoc(
      COLLECTIONS.SOCIETY_CONTRIBUTIONS,
      contributionData,
      contributionId
    );

    if (error) {
      throw new SocietyError(
        "CONTRIBUTION_FAILED",
        `Failed to log contribution: ${error.message}`
      );
    }

    return { id: contributionId };
  }

  /**
   * Verify contribution (founder only)
   */
  async verifyContribution(
    societyId: string,
    contributionId: string,
    verified: boolean = true
  ): Promise<void> {
    const { data: contribution } = await getDocById(
      COLLECTIONS.SOCIETY_CONTRIBUTIONS,
      contributionId
    );

    if (!contribution || contribution.society_id !== societyId) {
      throw new SocietyError("NOT_FOUND", "Contribution not found");
    }

    const now = Timestamp.now();
    const updateData = {
      status: verified ? "verified" : "completed",
      verified_at: now,
      updated_at: now,
    };

    await updateDocById(
      COLLECTIONS.SOCIETY_CONTRIBUTIONS,
      contributionId,
      updateData
    );
  }

  /**
   * Distribute revenue to members based on ownership %
   */
  async distributeRevenue(
    societyId: string,
    input: DistributeRevenueInput
  ): Promise<{ distribution_id: string; allocations: Record<string, number> }> {
    const members = await this.getSocietyMembers(societyId);
    const activeMembers = members.filter((m) => m.status === "active");

    if (activeMembers.length === 0) {
      throw new SocietyError("NO_MEMBERS", "No active members in society");
    }

    // Calculate distribution based on ownership %
    const allocations: Record<string, number> = {};
    activeMembers.forEach((member) => {
      allocations[member.user_id] = parseFloat(
        (
          input.revenue_amount *
          (member.ownership_percent / 100)
        ).toFixed(2)
      );
    });

    const distributionId = `dist_${nanoid(12)}`;
    const now = Timestamp.now();

    // Create main distribution transaction
    const transactionData = {
      id: distributionId,
      society_id: societyId,
      transaction_type: "distribution",
      amount: input.revenue_amount,
      currency: "USD",
      description: input.description || "Revenue distribution",
      allocations,
      created_at: now,
      updated_at: now,
    };

    const { error } = await insertDoc(
      COLLECTIONS.SOCIETY_TRANSACTIONS,
      transactionData,
      distributionId
    );

    if (error) {
      throw new SocietyError(
        "DISTRIBUTION_FAILED",
        `Failed to distribute revenue: ${error.message}`
      );
    }

    // Update society total revenue
    const society = await this.getSociety(societyId);
    await updateDocById(COLLECTIONS.SOCIETIES, societyId, {
      total_revenue: (society.total_revenue || 0) + input.revenue_amount,
      updated_at: now,
    });

    return { distribution_id: distributionId, allocations };
  }

  /**
   * Create default system chats for society
   */
  private async createDefaultChats(
    societyId: string,
    founderId: string
  ): Promise<void> {
    const now = Timestamp.now();

    const rearvyChat = {
      id: `chat_${societyId}_general`,
      society_id: societyId,
      chat_type: "system_general",
      name: "Rearvy Chat",
      description: "Platform updates, notifications, and general execution context",
      is_pinned: true,
      participant_ids: [founderId],
      created_by: founderId,
      created_at: now,
      updated_at: now,
      last_message_at: now,
    };

    const rearvyImportantChat = {
      id: `chat_${societyId}_important`,
      society_id: societyId,
      chat_type: "system_important",
      name: "Rearvy Important",
      description: "Critical assignments, project instructions, and expectations",
      is_pinned: true,
      participant_ids: [founderId],
      created_by: founderId,
      created_at: now,
      updated_at: now,
      last_message_at: now,
    };

    await Promise.all([
      insertDoc(COLLECTIONS.SOCIETY_CHATS, rearvyChat, rearvyChat.id),
      insertDoc(COLLECTIONS.SOCIETY_CHATS, rearvyImportantChat, rearvyImportantChat.id),
    ]);
  }

  private async addMemberToSystemChats(
    societyId: string,
    userId: string
  ): Promise<void> {
    const { getDocById: getDoc, upsertDoc } = await import(
      "@/lib/firebase/firestore"
    );
    const chatIds = [
      `chat_${societyId}_general`,
      `chat_${societyId}_important`,
    ];

    for (const chatId of chatIds) {
      const existing = await getDoc(COLLECTIONS.SOCIETY_CHATS, chatId);
      const participantIds = Array.isArray(existing.data?.participant_ids)
        ? existing.data.participant_ids
        : [];

      if (!participantIds.includes(userId)) {
        await upsertDoc(COLLECTIONS.SOCIETY_CHATS, chatId, {
          participant_ids: [...participantIds, userId],
        });
      }
    }
  }

  /**
   * Create direct chat between two users
   */
  private async createDirectChat(
    userId1: string,
    userId2: string,
    societyId: string
  ): Promise<void> {
    const chatId = [userId1, userId2].sort().join("_");
    const now = Timestamp.now();

    const chatData = {
      id: chatId,
      society_id: societyId,
      chat_type: "direct",
      participant_ids: [userId1, userId2],
      created_by: userId1,
      created_at: now,
      updated_at: now,
      last_message_at: now,
    };

    // Upsert so it doesn't fail if already exists
    const { getDocById: getDoc, upsertDoc } = await import(
      "@/lib/firebase/firestore"
    );
    const existing = await getDoc(COLLECTIONS.SOCIETY_CHATS, chatId);
    if (!existing.data) {
      await upsertDoc(COLLECTIONS.SOCIETY_CHATS, chatId, chatData);
    }
  }
}

export const societyService = new SocietyService();
