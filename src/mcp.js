/**
 * The MCP servers configured for a session (specs/075-skills-line).
 *
 * Three places name them, all local files: the user's own in
 * `~/.claude.json` under `mcpServers`, the project's in its `.mcp.json`
 * (minus the ones the person disabled for this project, which
 * `~/.claude.json` records under the project), and project-local ones kept
 * under the project in `~/.claude.json`. Nothing here says whether a server
 * connected; the bar counts what was asked for.
 */

import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const isBlock = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

function readJson(file) {
  try {
    const v = JSON.parse(readFileSync(file, "utf8"));
    return isBlock(v) ? v : null;
  } catch {
    return null;
  }
}

/** `{ count, names }` of the servers a session in `cwd` would load, or null when none. */
export function countMcpServers(cwd, { homedir = os.homedir() } = {}) {
  const root = readJson(path.join(homedir, ".claude.json")) ?? {};
  const project = isBlock(root.projects) && isBlock(root.projects[cwd]) ? root.projects[cwd] : {};
  const names = new Set();
  for (const k of Object.keys(isBlock(root.mcpServers) ? root.mcpServers : {})) names.add(k);
  for (const k of Object.keys(isBlock(project.mcpServers) ? project.mcpServers : {})) names.add(k);
  const disabled = new Set(Array.isArray(project.disabledMcpjsonServers) ? project.disabledMcpjsonServers.map(String) : []);
  const shared = readJson(path.join(cwd, ".mcp.json"));
  for (const k of Object.keys(isBlock(shared?.mcpServers) ? shared.mcpServers : {})) if (!disabled.has(k)) names.add(k);
  for (const k of Array.isArray(project.disabledMcpServers) ? project.disabledMcpServers.map(String) : []) names.delete(k);
  return names.size ? { count: names.size, names: [...names].sort() } : null;
}
