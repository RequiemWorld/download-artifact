import * as core from "@actions/core";
import * as github from "@actions/github";
import { DefaultArtifactClient } from "@actions/artifact";

/**
 * Finds all workflow runs associated with a specific commit hash
 * that were triggered by a push event.
 */
async function lookupWorkflowRunsByPushAndCommitHash(octokit, owner, repo, commitHash) {
    const { data } = await octokit.rest.actions.listWorkflowRunsForRepo({
        owner,
        repo,
        head_sha: commitHash,
        event: 'push'
    });
    return data.workflow_runs;
}

/**
 * Filters the list to find the latest run that is bound to a branch
 * and specifically NOT a tag.
 */
async function findOnlyWorkflowRunWithoutTag(runs) {
    // GitHub 'push' events for tags have a ref starting with 'refs/tags/'
    // We filter for runs where the ref starts with 'refs/heads/' (a branch)
    return runs.find(run =>
        run.head_branch !== null &&
        run.ref.startsWith('refs/heads/') &&
        run.status === 'completed'
    );
}

/**
 * Locates a specific artifact by name within a Run ID and returns the match object.
 * This remains a "pure" lookup without side effects like downloading.
 */
async function lookupArtifactWithNameInRunWithId(artifactClient, runId, owner, repo, token, artifactName) {
    const findOptions = {
        workflowRunId: runId,
        repositoryOwner: owner,
        repositoryName: repo,
        token: token
    };

    // List all artifacts for the specific Run ID
    const { artifacts } = await artifactClient.listArtifacts({
        findBy: findOptions
    });

    const match = artifacts.find(a => a.name === artifactName);

    if (!match) {
        throw new Error(`Artifact '${artifactName}' not found in run ${runId}`);
    }

    return match;
}

async function run() {
    try {
        // 1. Gather Inputs
        const path = core.getInput("path", { required: true });
        const token = core.getInput("token", { required: true });
        const commitHash = core.getInput("commit", { required: true });
        const artifactName = core.getInput("artifact-name", { required: true });

        const octokit = github.getOctokit(token);
        const { owner, repo } = github.context.repo;
        const artifactClient = new DefaultArtifactClient();

        // 2. Resolve the Target Workflow Run
        const allRuns = await lookupWorkflowRunsByPushAndCommitHash(octokit, owner, repo, commitHash);
        const targetRun = await findOnlyWorkflowRunWithoutTag(allRuns);

        if (!targetRun) {
            throw new Error(`Could not find a completed branch-push run for hash: ${commitHash}`);
        }
        core.info(`Target Run ID identified: ${targetRun.id} (Branch: ${targetRun.head_branch})`);

        // 3. Resolve the Specific Artifact ID
        const artifactMatch = await lookupArtifactWithNameInRunWithId(
            artifactClient,
            targetRun.id,
            owner,
            repo,
            token,
            artifactName
        );

        core.info(`Found artifact ${artifactName} (ID: ${artifactMatch.id}). Starting download...`);

        // 4. Execute the Download
        await artifactClient.downloadArtifact(artifactMatch.id, {
            path: path,
            findBy: {
                workflowRunId: targetRun.id,
                repositoryOwner: owner,
                repositoryName: repo,
                token: token
            }
        });

        core.info(`Success: Artifact downloaded to ${path}`);

    } catch (error) {
        // Set failed will catch both API errors and our custom Throws
        core.setFailed(error.message);
    }
}

// Start the action
run();