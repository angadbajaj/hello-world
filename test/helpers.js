import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Starts the real server on a random port with a throwaway database.
export async function startServer(env = {}) {
  const port = 3900 + Math.floor(Math.random() * 900);
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "qs-test-"));
  const proc = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", "src/server.js"], {
    env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, ANTHROPIC_API_KEY: "", ANTHROPIC_AUTH_TOKEN: "", ...env },
    stdio: "ignore",
  });
  const base = `http://localhost:${port}`;
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(`${base}/api/health`)).ok) break; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  return {
    base,
    stop() { proc.kill(); fs.rmSync(dataDir, { recursive: true, force: true }); },
    client() {
      let cookie = "";
      return async (url, { method = "GET", body, headers = {}, raw } = {}) => {
        const r = await fetch(base + url, {
          method, headers: { "content-type": "application/json", cookie, ...headers },
          body: raw ?? (body && JSON.stringify(body)),
        });
        const set = r.headers.get("set-cookie");
        if (set) cookie = set.split(";")[0];
        return { status: r.status, body: await r.json() };
      };
    },
  };
}
