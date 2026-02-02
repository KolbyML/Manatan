/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import 'dotenv/config';

type GithubAuthor = {
    name: string;
    user: { login: string } | null;
};

type GithubPullRequest = {
    number: string;
    url: string;
};

type GithubCommit = {
    oid: string;
    url: string;
    message: string;
    authors: {
        totalCount: number;
        nodes: GithubAuthor[];
    };
    associatedPullRequests: {
        nodes: GithubPullRequest[];
    };
};

type CommitQueryResponse = {
    data: {
        repository: {
            ref: {
                target: {
                    history: {
                        totalCount: number;
                        pageInfo: {
                            hasNextPage: boolean;
                            endCursor: string;
                        };
                        nodes: GithubCommit[];
                    };
                };
            };
        };
    };
};

type Commit = {
    repoUrl: string;
    revision: number;
    url: string;
    authors: GithubAuthor[];
    title: string;
    pullRequest?: GithubPullRequest;
};

const fetchCommits = async (
    owner: string,
    repo: string,
    loadUntilSha: string,
    endCursor?: string,
): Promise<{ totalRepoCommitCount: number; commits: GithubCommit[] }> => {
    const query = `query ($owner: String!, $name: String!, $afterSha: String) {
  repository(owner: $owner, name: $name) {
    ref(qualifiedName: "master") {
      target {
        ... on Commit {
          history(first: 100, after: $afterSha) {
            totalCount
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              oid
              # use "message" instead of "messageHeadline" because GitHub truncates titles if they are too long
              message
              url
              authors(first: 100) {
                totalCount
                nodes {
                  name
                  user {
                    login
                  }
                }
              }
              associatedPullRequests(first: 1) {
                nodes {
                  number
                  url
                }
              }
            }
          }
        }
      }
    }
  }
}`;

    const variables = {
        owner,
        name: repo,
        afterSha: endCursor,
    };

    const response = (await (
        await fetch('https://api.github.com/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
            },
            body: JSON.stringify({ query, variables }),
        })
    ).json()) as CommitQueryResponse;

    const repoHistory = response.data.repository.ref.target.history;
    const { hasNextPage, endCursor: repoHistoryEndCursor } = repoHistory.pageInfo;
    const commits = repoHistory.nodes;
    const indexOfOldestCommitToLoad = commits.findIndex((commit) => commit.oid === loadUntilSha);

    const loadedAllCommits = indexOfOldestCommitToLoad !== -1;
    if (loadedAllCommits) {
        return { totalRepoCommitCount: repoHistory.totalCount, commits: commits.slice(0, indexOfOldestCommitToLoad) };
    }

    if (!hasNextPage) {
        throw new Error(`No commit with sha "${loadUntilSha}" found!`);
    }

    const loadedCommits = [
        ...commits,
        ...(await fetchCommits(owner, repo, loadUntilSha, repoHistoryEndCursor)).commits,
    ];
    return { totalRepoCommitCount: repoHistory.totalCount, commits: loadedCommits };
};

const createCommitAuthorCredit = (authors: GithubAuthor[]): string => {
    const authorsWithGithubAccount = authors.filter((author) => !!author.user?.login);

    if (!authorsWithGithubAccount.length) {
        return `by @${authors[0].name}`;
    }

    const commitAuthorsString = authorsWithGithubAccount
        .map((author) => author.user!.login)
        .reduce((authorCredit, author) => `${authorCredit}, @${author}`);

    return `by @${commitAuthorsString}`;
};

const createChangelogCommitLine = (commit: Commit): string => {
    try {
        const authorCredit = createCommitAuthorCredit(commit.authors);
        const revision = `([r${commit.revision}](${commit.url}))`;

        if (!commit.pullRequest) {
            return `${revision} ${commit.title} (${authorCredit})`;
        }

        const title = commit.title.replace(/(.*) \(#[0-9]+\)$/g, '$1'); // remove the possible pr number from the title (e.g. "my commit title (#420)" => "my commit title")
        const prId = commit.pullRequest.number;
        const prUrl = commit.pullRequest.url;
        const prLink = `[#${prId}](${prUrl})`;

        return `${revision} ${title} (${prLink} ${authorCredit})`;
    } catch (e) {
        console.log('Unexpected commit format', commit);
        throw e;
    }
};

const getContributors = (commits: Commit[]): string[] => [
    ...new Set(
        commits
            .map((commit) => commit.authors.map((author) => author.user?.login!).filter((author) => !!author))
            .flat(),
    ),
];

export const createCommitChangelog = async (prevReleaseLastCommitSha: string): Promise<string> => {
    const owner = 'Suwayomi';
    const repo = 'Manatan-WebUI';

    const { totalRepoCommitCount: numberOfCommits, commits: githubCommits } = await fetchCommits(
        owner,
        repo,
        prevReleaseLastCommitSha,
    );

    const commits: Commit[] = githubCommits.map((githubCommit, index) => ({
        repoUrl: `https://github.com/${owner}/${repo}`,
        revision: numberOfCommits - index,
        url: githubCommit.url,
        authors: githubCommit.authors.nodes,
        title: githubCommit.message.split('\n')[0],
        pullRequest: githubCommit.associatedPullRequests.nodes[0],
    }));

    let changelog = '';

    const commitChangelogLines = commits.map(createChangelogCommitLine);
    commitChangelogLines.forEach((commit) => {
        changelog += `- ${commit}\n`;
    });

    const contributors = getContributors(commits);
    const contributorString = contributors.reduce((authorCredit, author) => `${authorCredit}, @${author}`);
    changelog += `\nContributors:\n@${contributorString}\n`;

    return changelog;
};
