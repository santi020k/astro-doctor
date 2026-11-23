import { spawn } from "node:child_process";
import { appendFile, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getPublishedVersion, waitForAllPublished } from "./registry-verification.mjs";

const PACKAGES_DIRECTORY = new URL("../packages/", import.meta.url);
const GITHUB_API_URL = "https://api.github.com";

const runCommand = async (command, argumentsList, workingDirectory) =>
  new Promise((resolve, reject) => {
    const childProcess = spawn(command, argumentsList, {
      cwd: workingDirectory,
      stdio: "inherit",
    });

    childProcess.once("error", reject);

    childProcess.once("exit", (exitCode, signal) => {
      if (exitCode === 0) {
        resolve();

        return;
      }

      reject(
        new Error(
          `${command} exited with ${exitCode ?? `signal ${signal ?? "unknown"}`}`,
        ),
      );
    });
  });

const requireCurrentMain = async () => {
  if (process.env.VALIDATED_COMMIT) {
    await runCommand("bash", [fileURLToPath(new URL("check-validated-commit.sh", import.meta.url)), "--require-current"], fileURLToPath(new URL("../", import.meta.url)));
  } else if (process.env.GITHUB_ACTIONS === "true") {
    throw new Error("CI publishing requires a validated main commit.");
  }
};

const getCommandOutput = async (command, argumentsList, workingDirectory) =>
  new Promise((resolve, reject) => {
    const childProcess = spawn(command, argumentsList, {
      cwd: workingDirectory,
      stdio: ["ignore", "pipe", "inherit"],
    });

    let output = "";

    childProcess.stdout.setEncoding("utf8");

    childProcess.stdout.on("data", (chunk) => {
      output += chunk;
    });

    childProcess.once("error", reject);

    childProcess.once("exit", (exitCode, signal) => {
      if (exitCode === 0) {
        resolve(output.trim());

        return;
      }

      reject(
        new Error(
          `${command} exited with ${exitCode ?? `signal ${signal ?? "unknown"}`}`,
        ),
      );
    });
  });

const writeChangesetsEvent = async (packageName, version) => {
  const outputPath = process.env.CHANGESETS_OUTPUT;

  if (!outputPath) {
    return;
  }

  const event = {
    type: "git-tag",
    tag: `${packageName}@${version}`,
    packageName,
  };

  await appendFile(outputPath, `${JSON.stringify(event)}\n`);
};

const getGitTagCommit = async (tag) => {
  const matchingTag = await getCommandOutput(
    "git",
    ["tag", "--list", tag],
    process.cwd(),
  );

  return matchingTag ? getCommandOutput("git", ["rev-list", "-n", "1", tag], process.cwd()) : "";
};

const hasGitHubRelease = async (tag) => {
  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;

  if (!repository || !token) {
    return false;
  }

  const response = await fetch(
    `${GITHUB_API_URL}/repos/${repository}/releases/tags/${encodeURIComponent(tag)}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );

  if (response.ok) {
    return true;
  }

  if (response.status === 404) {
    return false;
  }

  throw new Error(
    `GitHub returned ${response.status} while checking release ${tag}`,
  );
};

const createPackageRelease = async (packagePath, tag, headCommit, tagCommit, releaseExists) => {
  if (process.env.GITHUB_ACTIONS !== "true") return;

  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;

  if (!repository || !token) throw new Error("CI release metadata requires GitHub authentication.");

  if (!tagCommit) {
    await runCommand("git", ["tag", tag, headCommit], process.cwd());

    await requireCurrentMain();

    await runCommand("git", ["push", "origin", `refs/tags/${tag}`], process.cwd());
  }

  if (releaseExists) return;

  const changelog = await readFile(new URL("CHANGELOG.md", packagePath), "utf8");
  const version = tag.slice(tag.lastIndexOf("@") + 1);
  const lines = changelog.split("\n");
  const start = lines.findIndex(line => line.trim() === `## ${version}`);

  if (start < 0) throw new Error(`Missing changelog entry for ${tag}`);

  const following = lines.slice(start + 1);
  const end = following.findIndex(line => line.startsWith("## "));
  const body = (end < 0 ? following : following.slice(0, end)).join("\n").trim();

  await requireCurrentMain();

  const response = await fetch(`${GITHUB_API_URL}/repos/${repository}/releases`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: tag, tag_name: tag, target_commitish: headCommit, body, prerelease: version.includes("-") }),
  });

  if (!response.ok) throw new Error(`GitHub returned ${response.status} while creating release ${tag}`);
};

const publishPackage = async (packagePath) => {
  const packDirectory = await mkdtemp(path.join(os.tmpdir(), "astro-doctor-pack-"));

  const globalPackagesDirectory = await getCommandOutput(
    "pnpm",
    ["root", "--global"],
    packagePath,
  );

  const npmCliPath = path.join(
    globalPackagesDirectory,
    "npm",
    "bin",
    "npm-cli.js",
  );

  try {
    await runCommand(
      "pnpm",
      ["pack", "--pack-destination", packDirectory],
      packagePath,
    );

    const packFiles = (await readdir(packDirectory)).filter((fileName) =>
      fileName.endsWith(".tgz"),
    );

    if (packFiles.length !== 1) {
      throw new Error(
        `Expected one package archive in ${packDirectory}, found ${packFiles.length}`,
      );
    }

    await requireCurrentMain();

    await runCommand(
      "node",
      [
        npmCliPath,
        "publish",
        path.join(packDirectory, packFiles[0]),
        "--access",
        "public",
        "--provenance",
      ],
      packagePath,
    );
  } finally {
    await rm(packDirectory, { force: true, recursive: true });
  }
};

const packageDirectories = await readdir(PACKAGES_DIRECTORY, {
  withFileTypes: true,
});

const releases = [];

for (const packageDirectory of packageDirectories) {
  if (!packageDirectory.isDirectory()) {
    continue;
  }

  const packagePath = new URL(`${packageDirectory.name}/`, PACKAGES_DIRECTORY);
  const packageJsonPath = new URL("package.json", packagePath);
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));

  if (packageJson.private === true) {
    continue;
  }

  if (
    typeof packageJson.name !== "string" ||
    typeof packageJson.version !== "string"
  ) {
    throw new Error(`${packageJsonPath.pathname} must declare a name and version`);
  }

  const packageName = packageJson.name;
  const version = packageJson.version;

  releases.push({
    packageName,
    packagePath,
    publishedVersion: await getPublishedVersion(packageName, version),
    version,
  });
}

const newReleases = releases.filter((release) => !release.publishedVersion);

for (const release of newReleases) {
  await publishPackage(path.resolve(release.packagePath.pathname));
}

await waitForAllPublished(newReleases);

for (const { packageName, packagePath, publishedVersion, version } of releases) {
  const tag = `${packageName}@${version}`;
  const versionIsPublished = Boolean(publishedVersion);
  const tagCommit = await getGitTagCommit(tag);
  const releaseExists = await hasGitHubRelease(tag);

  const headCommit = await getCommandOutput(
    "git",
    ["rev-parse", "HEAD"],
    process.cwd(),
  );

  if (tagCommit && !releaseExists && tagCommit !== headCommit) {
    throw new Error(
      `${tag} points to ${tagCommit}, but this release is ${headCommit}`,
    );
  }

  if (!tagCommit || !releaseExists) {
    if (versionIsPublished && publishedVersion.gitHead !== headCommit) {
      throw new Error(`Cannot recover ${tag}: registry publishing SHA is missing or differs from ${headCommit}. Verify original provenance before metadata recovery.`);
    }

    await createPackageRelease(packagePath, tag, headCommit, tagCommit, releaseExists);

    console.log(`New tag: ${tag}`);

    await writeChangesetsEvent(packageName, version);
  }
}
