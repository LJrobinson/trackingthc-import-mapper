import { execFile } from "node:child_process";
import { constants } from "node:fs";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";

type CliResult = {
  code: number;
  stdout: string;
  stderr: string;
};

const require = createRequire(import.meta.url);
const testDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDir, "..");
const cliPath = path.join(projectRoot, "src", "cli.ts");
const tsxCliPath = require.resolve("tsx/cli");
const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) =>
      rm(dir, {
        force: true,
        recursive: true,
      }),
    ),
  );
});

describe("TrackingTHC Import Mapper CLI", () => {
  it("writes run-dir outputs for a clean import", async () => {
    const tempDir = await makeTempDir();
    const runDir = path.join(tempDir, "runs");
    const runId = "clean-run";

    const result = await runCli([
      "--csv",
      path.join(projectRoot, "tests", "fixtures", "clean-export.csv"),
      "--map",
      path.join(projectRoot, "samples", "korona-mapping.json"),
      "--run-dir",
      runDir,
      "--run-id",
      runId,
    ]);

    const runPath = path.join(runDir, runId);
    const normalizedPath = path.join(runPath, "normalized.csv");
    const warningsPath = path.join(runPath, "warnings.csv");
    const summaryPath = path.join(runPath, "summary.md");
    const manifestPath = path.join(runPath, "run-manifest.json");
    const indexPath = path.join(runDir, "index.json");

    expect(result.code).toBe(0);
    await expectFile(normalizedPath);
    await expectFile(warningsPath);
    await expectFile(summaryPath);
    await expectFile(manifestPath);
    await expectFile(indexPath);

    const normalized = await readFile(normalizedPath, "utf8");
    expect(normalized).toContain("20.00");
    expect(normalized).toContain("5.00");

    const warnings = await readFile(warningsPath, "utf8");
    expect(nonEmptyLines(warnings)).toHaveLength(1);

    const index = JSON.parse(await readFile(indexPath, "utf8")) as Array<{
      run_id: string;
    }>;
    expect(index).toHaveLength(1);
    expect(index[0]?.run_id).toBe(runId);
  });

  it("handles money-format values and reports warning totals", async () => {
    const tempDir = await makeTempDir();
    const runDir = path.join(tempDir, "runs");

    const result = await runCli([
      "--csv",
      path.join(projectRoot, "samples", "korona-export-money-example.csv"),
      "--map",
      path.join(projectRoot, "samples", "korona-mapping.json"),
      "--run-dir",
      runDir,
      "--run-id",
      "money-run",
    ]);

    expect(result.code).toBe(0);

    const runPath = path.join(runDir, "money-run");
    const warnings = await readFile(path.join(runPath, "warnings.csv"), "utf8");
    const summary = await readFile(path.join(runPath, "summary.md"), "utf8");
    const manifest = JSON.parse(
      await readFile(path.join(runPath, "run-manifest.json"), "utf8"),
    ) as {
      unit_costs_calculated: number;
    };

    expect(manifest.unit_costs_calculated).toBe(3);
    expect(warnings).toContain("INVALID_TOTAL_COST");
    expect(warnings).toContain("UNIT_COST_NOT_CALCULATED");
    expect(summary).toContain("Warnings: 2");
  });

  it("fails fast for a bad mapping without creating run outputs", async () => {
    const tempDir = await makeTempDir();
    const runDir = path.join(tempDir, "runs");
    const runId = "bad-run";
    const indexPath = path.join(runDir, "index.json");

    await mkdir(runDir, { recursive: true });
    await writeFile(indexPath, "[]\n", "utf8");

    const result = await runCli([
      "--csv",
      path.join(projectRoot, "samples", "korona-export-example.csv"),
      "--map",
      path.join(projectRoot, "samples", "korona-mapping-bad-header.json"),
      "--run-dir",
      runDir,
      "--run-id",
      runId,
    ]);

    const output = `${result.stdout}\n${result.stderr}`;
    const index = JSON.parse(await readFile(indexPath, "utf8")) as Array<{
      run_id?: string;
    }>;

    expect(result.code).not.toBe(0);
    expect(output).toContain("Mapping validation failed.");
    await expectMissing(path.join(runDir, runId));
    expect(index.some((entry) => entry.run_id === runId)).toBe(false);
  });
});

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "trackingthc-import-"));
  tempDirs.push(dir);
  return dir;
}

function runCli(args: string[]): Promise<CliResult> {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [tsxCliPath, cliPath, ...args],
      {
        cwd: projectRoot,
        encoding: "utf8",
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        resolve({
          code: getExitCode(error),
          stdout,
          stderr,
        });
      },
    );
  });
}

function getExitCode(error: unknown): number {
  if (!error) {
    return 0;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "number"
  ) {
    return (error as { code: number }).code;
  }

  return 1;
}

async function expectFile(filePath: string): Promise<void> {
  await expect(access(filePath, constants.F_OK)).resolves.toBeUndefined();
}

async function expectMissing(filePath: string): Promise<void> {
  await expect(access(filePath, constants.F_OK)).rejects.toMatchObject({
    code: "ENOENT",
  });
}

function nonEmptyLines(text: string): string[] {
  return text.split(/\r?\n/).filter((line) => line.trim() !== "");
}
