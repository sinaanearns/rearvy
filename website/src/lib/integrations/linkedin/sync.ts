import { Firestore } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/lib/firebase/schema";
import {
  getLinkedInUserProfile,
  getLinkedInProfilePosts,
  getLinkedInPostComments,
  persistRefreshedLinkedInTokens,
  LinkedInConfig,
} from "./client";




export async function syncLinkedInProfile(
  db: Firestore,
  userId: string,
  integrationId: string,
  config: LinkedInConfig
): Promise<{ profileId: string }> {
  const profile = await getLinkedInUserProfile(config);
  const profileId = profile.id;

  const profileData = {
    user_id: userId,
    integration_id: integrationId,
    linkedin_id: profile.id,
    first_name: profile.localizedFirstName,
    last_name: profile.localizedLastName,
    display_name: profile.displayName || `${profile.localizedFirstName} ${profile.localizedLastName}`,
    headline: profile.headline || null,
    vanity_name: profile.vanityName || null,
    profile_picture_url: profile.profilePicture?.displayImage || null,
    synced_at: new Date().toISOString(),
  };

  // Find existing profile or create new
  const existingSnapshot = await db
    .collection(COLLECTIONS.LINKEDIN_PROFILES)
    .where("user_id", "==", userId)
    .where("linkedin_id", "==", profile.id)
    .get();

  if (!existingSnapshot.empty) {
    await existingSnapshot.docs[0].ref.set(profileData, { merge: true });
  } else {
    await db.collection(COLLECTIONS.LINKEDIN_PROFILES).add(profileData);
  }

  return { profileId };
}

export async function syncLinkedInPosts(
  db: Firestore,
  userId: string,
  integrationId: string,
  config: LinkedInConfig,
  profileId: string
): Promise<{ synced: number }> {
  const posts = await getLinkedInProfilePosts(config, profileId, 50);
  let totalSynced = 0;

  const batch = db.batch();
  for (const post of posts) {
    const shareContent = post.specificContent["com.linkedin.ugc.ShareContent"];
    const media = shareContent.media || [];

    const postData = {
      user_id: userId,
      integration_id: integrationId,
      linkedin_id: profileId,
      post_urn: post.id,
      author_urn: post.author,
      lifecycle_state: post.lifecycleState,
      text_content: shareContent.shareCommentary?.text || null,
      media_category: shareContent.shareMediaCategory,
      media_urls: media.map(m => m.originalUrl).filter(Boolean),
      media_titles: media.map(m => m.title?.text).filter(Boolean),
      media_descriptions: media.map(m => m.description?.text).filter(Boolean),
      visibility: post.visibility["com.linkedin.ugc.MemberNetworkVisibility"],
      created_at_source: post.created ? new Date(post.created.time).toISOString() : null,
      last_modified_source: post.lastModified ? new Date(post.lastModified.time).toISOString() : null,
      synced_at: new Date().toISOString(),
    };

    // Find existing post or create new
    const existingSnapshot = await db
      .collection(COLLECTIONS.LINKEDIN_POSTS)
      .where("user_id", "==", userId)
      .where("post_urn", "==", post.id)
      .get();

    if (!existingSnapshot.empty) {
      batch.set(existingSnapshot.docs[0].ref, postData, { merge: true });
    } else {
      const newDocRef = db.collection(COLLECTIONS.LINKEDIN_POSTS).doc();
      batch.set(newDocRef, postData);
    }
    totalSynced++;
  }
  await batch.commit();

  return { synced: totalSynced };
}

export async function syncLinkedInComments(
  db: Firestore,
  userId: string,
  integrationId: string,
  config: LinkedInConfig
): Promise<{ synced: number }> {
  // Get recent posts to fetch comments for
  const recentPostsSnapshot = await db
    .collection(COLLECTIONS.LINKEDIN_POSTS)
    .where("user_id", "==", userId)
    .orderBy("created_at_source", "desc")
    .limit(20)
    .get();

  if (recentPostsSnapshot.empty) {
    return { synced: 0 };
  }

  let totalSynced = 0;

  for (const postDoc of recentPostsSnapshot.docs) {
    const postData = postDoc.data();
    if (!postData.post_urn) continue;

    try {
      const comments = await getLinkedInPostComments(config, postData.post_urn, 50);

      const batch = db.batch();
      for (const comment of comments) {
        const commentData = {
          user_id: userId,
          integration_id: integrationId,
          post_urn: postData.post_urn,
          comment_urn: comment.id,
          parent_comment_urn: comment.parentComment || null,
          author_name: comment.actor?.name || null,
          author_image_url: comment.actor?.image || null,
          text_content: comment.message?.text || null,
          like_count: comment.socialDetail?.totalLikes || 0,
          created_at_source: new Date(comment.created.time).toISOString(),
          last_modified_source: new Date(comment.lastModified.time).toISOString(),
          synced_at: new Date().toISOString(),
        };

        // Find existing comment or create new
        const existingSnapshot = await db
          .collection(COLLECTIONS.LINKEDIN_COMMENTS)
          .where("user_id", "==", userId)
          .where("comment_urn", "==", comment.id)
          .get();

        if (!existingSnapshot.empty) {
          batch.set(existingSnapshot.docs[0].ref, commentData, { merge: true });
        } else {
          const newDocRef = db.collection(COLLECTIONS.LINKEDIN_COMMENTS).doc();
          batch.set(newDocRef, commentData);
        }
        totalSynced++;
      }
      await batch.commit();
    } catch (error) {
      // Comments may fail for some posts - skip and continue
      console.warn(`Failed to sync comments for post ${postData.post_urn}:`, error);
    }
  }

  return { synced: totalSynced };
}

export async function runFullSync(
  db: Firestore,
  userId: string,
  integrationId: string,
  config: LinkedInConfig
) {
  // 1. Sync profile info
  const { profileId } = await syncLinkedInProfile(db, userId, integrationId, config);

  // 2. Sync posts
  const posts = await syncLinkedInPosts(db, userId, integrationId, config, profileId);

  // 3. Sync comments for recent posts
  const comments = await syncLinkedInComments(db, userId, integrationId, config);

  // 4. Persist any refreshed tokens
  if (config.refreshToken && config.tokenExpiresAt) {
    await persistRefreshedLinkedInTokens(
      db,
      integrationId,
      config.accessToken,
      config.tokenExpiresAt
    );
  }

  // 5. Update last_synced_at
  await db
    .collection(COLLECTIONS.INTEGRATIONS)
    .doc(integrationId)
    .update({ last_synced_at: new Date().toISOString() });

  return {
    profileId,
    posts: posts.synced,
    comments: comments.synced,
  };
}

