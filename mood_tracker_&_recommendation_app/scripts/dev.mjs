import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const children = [];
let isShuttingDown = false;

function start(name, relativeScript, args = []) {
  const scriptPath = resolve(rootDir, relativeScript);
  const child = spawn(process.execPath, [scriptPath, ...args], {
    cwd: rootDir,
    stdio: "inherit",
  });

  child.on("exit", (code, signal) => {
    if (!isShuttingDown) {
      isShuttingDown = true;
      for (const c of children) {
        if (c.pid && !c.killed) c.kill("SIGTERM");
      }
      const reason = signal ? `${name} exited with signal ${signal}` : `${name} exited with code ${code ?? 0}`;
      process.exitCode = code && code !== 0 ? code : 1;
      console.error(reason);
    }
  });

  children.push(child);
}

function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  for (const child of children) {
    if (child.pid && !child.killed) child.kill("SIGTERM");
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

start("convex", "node_modules/convex/bin/main.js", ["dev"]);
start("vite", "node_modules/vite/bin/vite.js", ["--open"]);
