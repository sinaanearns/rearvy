import type { Firestore } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/lib/firebase/schema";
import {
  GitHubConfig,
  getGitHubUserProfile,
  listGitHubRepositories,
  listRepositoryIssues,
} from "./client";

function stableDocId(...parts: string[]): string {
  return parts.map((part) => encodeURIComponent(part)).join("__");
}

async function commitBatchIfNeeded(
async function commitBatchIfNeeded(batch: WriteBatch, writeCount: number) {
  if (writeCount > 0) {
    await batch.commit();
  }
}

export async function runFullSync(
  db: Firestore,
  userId: string,
  integrationId: string,
  config: GitHubConfig
) {
  const profile = await getGitHubUserProfile(config);
  const repositories = await listGitHubRepositories(config, 40);

  await db
    .collection(COLLECTIONS.INTEGRATIONS)
    .doc(integrationId)
    .set(
      {
        provider_account_id: String(profile.id),
        provider_account_name: profile.name || profile.login,
        last_synced_at: new Date().toISOString(),
      },
      { merge: true }
    );

  let batch = db.batch();
  let writeCount = 0;
  let syncedIssues = 0;
  let syncedPullRequests = 0;

  for (const repository of repositories) {
    const repoRef = db
      .collection(COLLECTIONS.GITHUB_REPOS)
      .doc(stableDocId(integrationId, String(repository.id)));

    batch.set(
      repoRef,
      {
        user_id: userId,
        integration_id: integrationId,
        repo_id: String(repository.id),
        repo_full_name: repository.full_name,
        name: repository.name,
        owner_login: repository.owner.login,
        html_url: repository.html_url,
        description: repository.description,
        is_private: repository.private,
        is_fork: repository.fork,
        is_archived: repository.archived,
        default_branch: repository.default_branch,
        language: repository.language,
        stargazers_count: repository.stargazers_count,
        watchers_count: repository.watchers_count,
        forks_count: repository.forks_count,
        open_issues_count: repository.open_issues_count,
        pushed_at: repository.pushed_at,
        synced_at: new Date().toISOString(),
      },
      { merge: true }
    );
    writeCount += 1;

    if (writeCount >= 450) {
      await batch.commit();
      batch = db.batch();
      writeCount = 0;
    }
  }

  const recentRepositories = repositories.slice(0, 5);
  for (const repository of recentRepositories) {
    const issues = await listRepositoryIssues(config, repository.full_name, 20);

    for (const issue of issues) {
      const isPullRequest = Boolean(issue.pull_request);
      const collectionName = isPullRequest
        ? COLLECTIONS.GITHUB_PULL_REQUESTS
        : COLLECTIONS.GITHUB_ISSUES;
      const docRef = db
        .collection(collectionName)
        .doc(stableDocId(integrationId, repository.full_name, String(issue.id)));

      batch.set(
        docRef,
        {
          user_id: userId,
          integration_id: integrationId,
          repo_id: String(repository.id),
          repo_full_name: repository.full_name,
          issue_id: String(issue.id),
          issue_number: issue.number,
          title: issue.title,
          state: issue.state,
          html_url: issue.html_url,
          author_login: issue.user?.login || null,
          labels: issue.labels.map((label) => label.name),
          comments_count: issue.comments,
          created_at_source: issue.created_at,
          updated_at_source: issue.updated_at,
          closed_at: issue.closed_at,
          is_pull_request: isPullRequest,
          synced_at: new Date().toISOString(),
        },
        { merge: true }
      );

      writeCount += 1;
      if (isPullRequest) {
        syncedPullRequests += 1;
      } else {
        syncedIssues += 1;
      }

      if (writeCount >= 450) {
        await batch.commit();
        batch = db.batch();
        writeCount = 0;
      }
    }
  }

  await commitBatchIfNeeded(batch, writeCount);

  return {
    repositories: repositories.length,
    issues: syncedIssues,
    pullRequests: syncedPullRequests,
  };
}