import { spawnSync } from "node:child_process";
import { createRailwayContext, type ProjectDefinition, type ServiceNode } from "railway/iac";
import { describe, expect, it } from "vitest";
import program, { ENVIRONMENTS, type EnvironmentName, GAMES, GATEWAY } from "./railway.ts";

async function plan(environment: string): Promise<ServiceNode[]> {
  const definition: ProjectDefinition = await program(createRailwayContext({ environment }), (name, def) => ({
    name,
    ...def,
  }));
  return (definition.resources ?? []).flat() as ServiceNode[];
}

describe.each(Object.keys(ENVIRONMENTS) as EnvironmentName[])("railway.ts in %s", (environment) => {
  const { branch, appEnv } = ENVIRONMENTS[environment];

  it("has the gateway and one service per game", async () => {
    expect((await plan(environment)).map((s) => s.name)).toEqual([GATEWAY, ...GAMES.map((g) => g.service)]);
  });

  it("tells the gateway which games it serves and which are still planned", async () => {
    const gateway = (await plan(environment)).find((s) => s.name === GATEWAY);
    const list = (name: string) => {
      const v = gateway?.variables?.[name];
      return v && "value" in v ? String(v.value).split(",").filter(Boolean) : [];
    };
    expect(list("GAMES")).toEqual(GAMES.map((g) => g.service));
    expect(list("PLANNED_GAMES")).toEqual(
      ["team-1", "team-2", "team-3", "team-4"].filter((t) => !GAMES.some((g) => g.service === t)),
    );
  });

  it("makes games trust the gateway and Railway's edge, and nobody else", async () => {
    for (const s of await plan(environment)) {
      const hops = s.variables?.TRUST_PROXY_HOPS;
      if (s.name === GATEWAY) expect(hops).toBeUndefined();
      else expect(hops).toEqual({ type: "literal", value: "2" });
    }
  });

  it("deploys the right branch, and only after CI passed", async () => {
    for (const s of await plan(environment)) {
      expect(s.source).toMatchObject({ type: "github", repo: "nd2003/sdm2026-1", branch, checkSuites: true });
    }
  });

  it("runs one replica, health-checked on /health, with the right APP_ENV", async () => {
    for (const s of await plan(environment)) {
      const replicas = Object.values(s.deploy?.multiRegionConfig ?? {}).map((r) => r?.numReplicas ?? 0);
      expect(replicas).toEqual([1]);
      expect(s.deploy?.healthcheckPath).toBe("/health");
      expect(s.deploy?.sleepApplication).toBe(false);
      expect(s.deploy?.startCommand).toMatch(/^node /);
      expect(s.variables?.APP_ENV).toEqual({ type: "literal", value: appEnv });
    }
  });
});

describe("railway.ts", () => {
  it("never deploys main to production", () => {
    expect(ENVIRONMENTS.production.branch).toBe("prod");
  });

  it("starts the gateway from its own folder and watches it", async () => {
    const gateway = (await plan("production")).find((s) => s.name === GATEWAY);
    expect(gateway?.deploy?.startCommand).toBe("node --import tsx server/gateway/server.ts");
    expect(gateway?.build?.watchPatterns).toContain("/server/gateway/**");
  });

  it("refuses an environment it doesn't manage", async () => {
    await expect(plan("staging")).rejects.toThrow(/not "staging"/);
  });

  it("loads with plain Node type stripping, the way the Railway CLI runs it", () => {
    // A file:// URL, not a path: on Windows, import("D:\\...") reads "d:" as a URL scheme and fails.
    const url = new URL("./railway.ts", import.meta.url).href;
    const run = spawnSync(
      process.execPath,
      ["--experimental-strip-types", "--input-type=module", "-e", `await import(${JSON.stringify(url)});`],
      { encoding: "utf8" },
    );
    expect(run.stderr).not.toMatch(/Error/);
    expect(run.status).toBe(0);
  });
});
