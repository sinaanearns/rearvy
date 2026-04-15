import { Firestore } from "firebase-admin/firestore";
import { encrypt } from "@/lib/utils/encryption";
import { COLLECTIONS } from "@/lib/firebase/schema";

const GITHUB_API_BASE = "https://api.github.com";

export interface GitHubConfig {
  accessToken: string;
}

export interface GitHubUserProfile {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  html_url: string;
}

export interface GitHubRepository {
  id: number;
  node_id: string;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  fork: boolean;
  archived: boolean;
  disabled: boolean;
  created_at: string;
  updated_at: string;
  pushed_at: string | null;
  default_branch: string;
  language: string | null;
  stargazers_count: number;
  watchers_count: number;
  forks_count: number;
  open_issues_count: number;
  owner: {
    login: string;
    id: number;
    avatar_url: string | null;
    html_url: string;
  };
}

export interface GitHubIssueItem {
  id: number;
  node_id: string;
  number: number;
  title: string;
  state: "open" | "closed";
  html_url: string;
  user?: {
    login: string;
    id: number;
    avatar_url: string | null;
    html_url: string;
  };
  labels: Array<{
    id: number;
    name: string;
    color: string;
    description: string | null;
  }>;
  comments: number;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  pull_request?: {
    url: string;
    html_url?: string;
    diff_url?: string;
    patch_url?: string;
  };
}

async function githubFetch<T>(
  config: GitHubConfig,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${GITHUB_API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${config.accessToken}`,
      "User-Agent": "Rearvy",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API error (${res.status}): ${text}`);
  }

  return (await res.json()) as T;
}

export async function exchangeGitHubCode(
  code: string,
  redirectUri: string
): Promise<{ accessToken: string }> {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing GitHub OAuth credentials");
  }

  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub token exchange failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!data.access_token) {
    throw new Error(data.error_description || data.error || "GitHub token exchange failed");
  }

  return { accessToken: data.access_token };
}

export async function getGitHubUserProfile(
  config: GitHubConfig
): Promise<GitHubUserProfile> {
  return githubFetch<GitHubUserProfile>(config, "/user");
}

export async function listGitHubRepositories(
  config: GitHubConfig,
  maxRepositories = 40
): Promise<GitHubRepository[]> {
  const repositories: GitHubRepository[] = [];
  const perPage = 50;

  for (let page = 1; repositories.length < maxRepositories; page += 1) {
    const batch = await githubFetch<GitHubRepository[]>(
      config,
      `/user/repos?per_page=${perPage}&page=${page}&sort=updated&direction=desc&affiliation=owner,collaborator,organization_member`
    );

    repositories.push(...batch);

    if (batch.length < perPage) {
      break;
    }
  }

  return repositories.slice(0, maxRepositories);
}

export async function listRepositoryIssues(
  config: GitHubConfig,
  repositoryFullName: string,
  maxIssues = 20
): Promise<GitHubIssueItem[]> {
  const [owner, repo] = repositoryFullName.split("/");
  if (!owner || !repo) {
    throw new Error(`Invalid GitHub repository name: ${repositoryFullName}`);
  }

  const issues = await githubFetch<GitHubIssueItem[]>(
    config,
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues?state=all&per_page=${maxIssues}&sort=updated&direction=desc`
  );

  return issues.slice(0, maxIssues);
}

export async function persistRefreshedGitHubToken(
  db: Firestore,
  integrationId: string,
  accessToken: string
): Promise<void> {
  const { encrypted, iv } = encrypt(accessToken);
  await db
    .collection(COLLECTIONS.INTEGRATIONS)
    .doc(integrationId)
    .update({
      access_token_enc: encrypted,
      token_iv: iv,
    });
}