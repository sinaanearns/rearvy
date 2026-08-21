import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from '../types';
import { COLLECTIONS } from '@/lib/firebase/schema';
import { createServerLogger } from '@/lib/server-logger';

const log = createServerLogger('UpdateProfileTool');

export function updateProfile(ctx: ToolContext) {
  return tool({
    description: "Update the user's profile metadata and preferences such as full name, business name, bio, skills, timezone, currency, etc.",
    inputSchema: z.object({
      full_name: z.string().optional(),
      business_name: z.string().optional(),
      business_type: z.enum(['shopify', 'content_creator', 'agency', 'other']).nullable().optional(),
      bio: z.string().optional(),
      working_on: z.string().optional(),
      skills: z.array(z.string()).nullable().optional(),
      project_links: z.array(z.string()).nullable().optional(),
      avatar_url: z.string().optional(),
      timezone: z.string().optional(),
      currency: z.string().optional(),
      metamask_address: z.string().optional(),
      metamask_chain_id: z.string().optional(),
      metamask_network: z.string().optional(),
    }),
    execute: async (input) => {
      try {
        const userId = ctx.userId;
        if (!userId) {
          throw new Error('User ID is required');
        }
        if (!input || typeof input !== "object") {
          log.warn("updateProfile called without a valid input payload");
          return { success: false };
        }

        const profileRef = ctx.adminDb.collection(COLLECTIONS.PROFILES).doc(userId);

        const updateData: Record<string, any> = {
          updated_at: new Date(),
        };

        if (input.full_name !== undefined) {
          updateData.full_name = input.full_name ?? null;
        }
        if (input.business_name !== undefined) {
          updateData.business_name = input.business_name ?? null;
        }
        if (input.business_type !== undefined) {
          updateData.business_type = input.business_type ?? null;
        }
        if (input.bio !== undefined) {
          updateData.bio = input.bio ?? null;
        }
        if (input.working_on !== undefined) {
          updateData.working_on = input.working_on ?? null;
        }
        if (input.skills !== undefined) {
          updateData.skills = input.skills ?? null;
        }
        if (input.project_links !== undefined) {
          updateData.project_links = input.project_links ?? null;
        }
        if (input.avatar_url !== undefined) {
          updateData.avatar_url = input.avatar_url ?? null;
        }
        if (input.timezone !== undefined) {
          updateData.timezone = input.timezone ?? null;
        }
        if (input.currency !== undefined) {
          updateData.currency = input.currency ?? null;
        }
        if (input.metamask_address !== undefined) {
          updateData.metamask_address = input.metamask_address ?? null;
        }
        if (input.metamask_chain_id !== undefined) {
          updateData.metamask_chain_id = input.metamask_chain_id ?? null;
        }
        if (input.metamask_network !== undefined) {
          updateData.metamask_network = input.metamask_network ?? null;
        }

        const hasChanges = Object.keys(updateData).length > 1;
        if (hasChanges) {
          await profileRef.update(updateData);
        }

        return { success: true };
      } catch (error) {
        log.error('Failed to update profile:', error);
        return { success: false };
      }
    },
  });
}

