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

type MobyJsonSidecar = {
  mappingProfile: {
    id: string;
    name: string;
    source: string;
    createdAt: string;
    mappings: Array<{
      sourceField: string;
      canonicalField?: string;
      status: string;
    }>;
  };
  importRun: {
    id: string;
    source: string;
    status: string;
    filename: string;
    startedAt: string;
    completedAt: string;
    summary: {
      rowCount: number;
      successCount: number;
      warningCount: number;
      errorCount: number;
    };
  };
  validationIssues: Array<{
    code: string;
    severity: string;
    message: string;
    field?: string;
    rowNumber?: number;
    metadata?: Record<string, unknown>;
  }>;
  packages?: Array<{
    id: string;
    label?: string;
    quantity?: {
      value: number;
      unit: string;
    };
    totalCost?: {
      amount: number;
      currency: string;
    };
    unitCost?: {
      amount: number;
      currency: string;
    };
    metadata?: Record<string, unknown>;
    externalReferences?: Array<{
      system: string;
      externalId: string;
      label?: string;
    }>;
  }>;
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
    const mobyJsonPath = path.join(runPath, "moby.json");

    expect(result.code).toBe(0);
    await expectFile(normalizedPath);
    await expectFile(warningsPath);
    await expectFile(summaryPath);
    await expectFile(manifestPath);
    await expectFile(indexPath);
    await expectMissing(mobyJsonPath);

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

  it("writes a MOBY JSON sidecar when requested", async () => {
    const tempDir = await makeTempDir();
    const runDir = path.join(tempDir, "runs");
    const runId = "moby-run";
    const mobyJsonPath = path.join(tempDir, "sidecars", "moby.json");

    const result = await runCli([
      "--csv",
      path.join(projectRoot, "samples", "korona-export-cursed-example.csv"),
      "--map",
      path.join(projectRoot, "samples", "korona-mapping.json"),
      "--run-dir",
      runDir,
      "--run-id",
      runId,
      "--moby-json",
      mobyJsonPath,
    ]);

    const runPath = path.join(runDir, runId);
    const normalizedPath = path.join(runPath, "normalized.csv");
    const warningsPath = path.join(runPath, "warnings.csv");
    const summaryPath = path.join(runPath, "summary.md");
    const manifestPath = path.join(runPath, "run-manifest.json");
    const indexPath = path.join(runDir, "index.json");

    expect(result.code).toBe(0);
    expect(result.stdout).toContain(`MOBY JSON written: ${mobyJsonPath}`);
    await expectFile(normalizedPath);
    await expectFile(warningsPath);
    await expectFile(summaryPath);
    await expectFile(manifestPath);
    await expectFile(indexPath);
    await expectFile(mobyJsonPath);

    const mobyJson = JSON.parse(
      await readFile(mobyJsonPath, "utf8"),
    ) as MobyJsonSidecar;

    expect(mobyJson.mappingProfile).toMatchObject({
      id: "moby-run-mapping-profile",
      name: "korona import mapping",
      source: "korona",
    });
    expect(mobyJson.mappingProfile.createdAt).toBe(
      mobyJson.importRun.startedAt,
    );
    expect(mobyJson.mappingProfile.mappings).toContainEqual({
      sourceField: "Package ID",
      canonicalField: "package.id",
      status: "mapped",
    });
    expect(mobyJson.importRun).toMatchObject({
      id: "moby-run",
      source: "korona",
      status: "completed_with_warnings",
      filename: path.join(
        projectRoot,
        "samples",
        "korona-export-cursed-example.csv",
      ),
      completedAt: mobyJson.importRun.startedAt,
      summary: {
        rowCount: 4,
        successCount: 4,
        warningCount: mobyJson.validationIssues.length,
        errorCount: 0,
      },
    });
    expect(mobyJson.validationIssues.length).toBeGreaterThan(0);

    const missingPackageIssue = mobyJson.validationIssues.find(
      (issue) => issue.code === "MISSING_PACKAGE_ID",
    );

    expect(missingPackageIssue).toMatchObject({
      code: "MISSING_PACKAGE_ID",
      severity: "warning",
      message: "Package ID is missing.",
      field: "package.id",
      rowNumber: 2,
      metadata: {
        productName: "Blue Dream 3.5g",
        packageId: "",
        quantity: "20",
        totalCost: "400.00",
      },
    });
  });

  it("includes InventoryPackage entities in the MOBY JSON sidecar", async () => {
    const tempDir = await makeTempDir();
    const runDir = path.join(tempDir, "runs");
    const runId = "moby-packages-run";
    const sourceFile = path.join(
      projectRoot,
      "tests",
      "fixtures",
      "clean-export.csv",
    );
    const mobyJsonPath = path.join(tempDir, "sidecars", "moby-packages.json");

    const result = await runCli([
      "--csv",
      sourceFile,
      "--map",
      path.join(projectRoot, "samples", "korona-mapping.json"),
      "--run-dir",
      runDir,
      "--run-id",
      runId,
      "--moby-json",
      mobyJsonPath,
    ]);

    expect(result.code).toBe(0);
    await expectFile(path.join(runDir, runId, "normalized.csv"));
    await expectFile(path.join(runDir, runId, "warnings.csv"));
    await expectFile(path.join(runDir, runId, "summary.md"));
    await expectFile(path.join(runDir, runId, "run-manifest.json"));
    await expectFile(path.join(runDir, "index.json"));
    await expectFile(mobyJsonPath);

    const mobyJson = JSON.parse(
      await readFile(mobyJsonPath, "utf8"),
    ) as MobyJsonSidecar;

    expect(Array.isArray(mobyJson.packages)).toBe(true);
    expect(mobyJson.packages?.[0]).toMatchObject({
      id: "package_1A406030000123",
      label: "1A406030000123",
      quantity: {
        value: 20,
        unit: "each",
      },
      totalCost: {
        amount: 400,
        currency: "USD",
      },
      unitCost: {
        amount: 20,
        currency: "USD",
      },
      metadata: {
        productName: "Blue Dream 3.5g",
        vendorName: "Some Vendor",
        rowNumber: 2,
        sourceFile,
      },
      externalReferences: [
        {
          system: "korona",
          externalId: `${sourceFile}:2`,
          label: "Normalized row reference",
        },
      ],
    });
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
