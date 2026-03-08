import * as core from "@actions/core";
import * as github from "@actions/github";
import { DefaultArtifactClient } from "@actions/artifact";


async function run() {
    const path = core.getInput("path", { required: true });
    const token = core.getInput("token", { required: true });
    const commitHash = core.getInput("commit", { required: true });
    const artifactName = core.getInput("artifact-name", { required: true });
    const octokit = github.getOctokit(token);
    const artifactClient = new DefaultArtifactClient();
    core.info("doing nothing");
}

// Start the action
run();