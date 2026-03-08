import * as core from "@actions/core";
import * as github from "@actions/github";
import {DefaultArtifactClient} from "@actions/artifact";
import {GitHub} from "@actions/github/lib/utils";

type GitHubClient = ReturnType<typeof github.getOctokit>;
type GithubContext = typeof github.context;
type WorkflowRun = Awaited<ReturnType<InstanceType<typeof GitHub>["rest"]["actions"]["listWorkflowRunsForRepo"]>>["data"]["workflow_runs"][number];

interface RelevantWorkflowRunInfo {
    id: number;
    head_branch: string | null;
    path: string
    event: string | null;
    status: string | null;
}

class LocalizedWorkflowFacade {
    private octokit: any;
    private context: any;

    constructor(octokit: any, context: any) {
        this.octokit = octokit;
        this.context = context;
    }

    public async fetchWorkflowRunsByCommitHash(hash: string, branch: string): Promise<RelevantWorkflowRunInfo[]> {
        const response = await this.octokit.rest.actions.listWorkflowRunsForRepo({
            owner: this.context.repo.owner,
            repo: this.context.repo.repo,
            head_sha: hash,
            branch: branch
        });

        function translate(run: WorkflowRun): RelevantWorkflowRunInfo {
            return {
                id: run.id,
                head_branch: run.head_branch,
                path: run.path,
                event: run.event,
                status: run.status
            };
        }
        return response.data.workflow_runs.map(translate);
    }
}

// The reference which is usually used to check for a tag isn't on
// the workflow run result from the API. AI suggested that if there
// is a tag the head_branch will be null and otherwise the branch name.
function checkIfRunIsForWorkflowAndHasNoTag(run: RelevantWorkflowRunInfo, workflowPath: string) {
    return run.event === "push" &&
        run.head_branch !== null &&
        run.head_branch !== "" &&
        run.path == workflowPath;
}

async function findWorkflowRun(
    workflowFacade: LocalizedWorkflowFacade,
    commitHash: string,
    branchName: string,
    workflowFile: string): Promise<RelevantWorkflowRunInfo | undefined> {

    const workflowRuns = await workflowFacade.fetchWorkflowRunsByCommitHash(commitHash, branchName);
    function findMatchingWorkflowRun(run: RelevantWorkflowRunInfo) {
        return checkIfRunIsForWorkflowAndHasNoTag(run, workflowFile);
    }
    return workflowRuns.find(findMatchingWorkflowRun);
}


async function main(workflowFacade: LocalizedWorkflowFacade) {
    const path = core.getInput("path", { required: true });
    const commitHash = core.getInput("commit", { required: true });
    const branchName = core.getInput("branch", { required: true });
    const workflowFile = core.getInput("workflow", { required: true });
    const artifactName = core.getInput("artifact-name", { required: true });
    const relevantWorkflowRun = await findWorkflowRun(
        workflowFacade,
        commitHash,
        branchName,
        workflowFile
    );
    if (!relevantWorkflowRun) {
        core.error("unable to find a workflow run matching the given criteria")
        return;
    }
    core.info(String(relevantWorkflowRun));

}

async function run() {
    const token = core.getInput("token", { required: true });
    const octokit = github.getOctokit(token);
    const workflowFacade = new LocalizedWorkflowFacade(octokit, github.context);
    await main(workflowFacade);

}

// Start the action
run();