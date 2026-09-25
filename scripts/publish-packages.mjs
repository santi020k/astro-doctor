import { spawn } from "node:child_process";
import { appendFile, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  HTTP_NOT_FOUND_STATUS,
  HTTP_SERVER_ERROR_MIN_STATUS,
  HTTP_TOO_MANY_REQUESTS_STATUS,
  PUBLISH_VERIFY_INTERVAL_MS,
  PUBLISH_VERIFY_MAX_ATTEMPTS,
} from "./constants.ts";

const PACKAGES_DIRECTORY = new URL("../packages/", import.meta.url);
const GITHUB_API_URL = "https://api.github.com";
const NPM_REGISTRY_URL = "https://registry.npmjs.org";

class NpmRegistryError extends Error {
  constructor(status, packageName, version) {
    super(`npm registry returned ${status} for ${packageName}@${version}`);

    this.status = status;
  }
}

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

const getPackageVersionUrl = (packageName, version) =>
  `${NPM_REGISTRY_URL}/${encodeURIComponent(packageName)}/${version}`;

const isPublished = async (packageName, version) => {
  const response = await fetch(getPackageVersionUrl(packageName, version));

  if (response.ok) {
    return true;
  }

  if (response.status === HTTP_NOT_FOUND_STATUS) {
    return false;
  }

  throw new NpmRegistryError(response.status, packageName, version);
};

const isTransientRegistryError = (error) =>
  error instanceof TypeError ||
  (error instanceof NpmRegistryError &&
    (error.status === HTTP_TOO_MANY_REQUESTS_STATUS ||
      error.status >= HTTP_SERVER_ERROR_MIN_STATUS));

const waitForPublished = async (packageName, version) => {
  for (
    let attempt = 1;
    attempt <= PUBLISH_VERIFY_MAX_ATTEMPTS;
    attempt += 1
  ) {
    try {
      if (await isPublished(packageName, version)) {
        return true;
      }
    } catch (error) {
      if (!isTransientRegistryError(error)) {
        throw error;
      }
    }

    await new Promise((resolve) => {
      setTimeout(resolve, PUBLISH_VERIFY_INTERVAL_MS);
    });
  }

  return false;
};

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
  const tag = `${packageName}@${version}`;
  const versionIsPublished = await isPublished(packageName, version);

  if (!versionIsPublished) {
    await publishPackage(path.resolve(packagePath.pathname));

    if (!(await waitForPublished(packageName, version))) {
      throw new Error(`${packageName}@${version} was not found after publishing`);
    }
  }

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
    console.log(`New tag: ${tag}`);

    await writeChangesetsEvent(packageName, version);
  }
}
