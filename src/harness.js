/**
 * Which coding agent is running the bar (specs/029-multi-harness).
 *
 * GitHub Copilot CLI runs a status line command the way Claude Code does,
 * with its own payload. Its loader exports `COPILOT_CLI_BINARY_VERSION` to the
 * command, and its payload alone carries `ai_used`; either is enough. The
 * Copilot-only chips (premium requests, allow-all) do not need this: they
 * show whenever their fields are present. Anything else is Claude Code.
 *
 * Codex CLI sends nothing: the payload a `codex` block marks is one this
 * plugin built from Codex's rollout (src/codexRollout.js, specs/035-codex-pane).
 */
export function detectHarness(payload, env = process.env) {
  if (payload && typeof payload === "object" && payload.codex && typeof payload.codex === "object" && !Array.isArray(payload.codex)) return "codex";
  if (env?.COPILOT_CLI_BINARY_VERSION) return "copilot";
  if (payload && typeof payload === "object" && "ai_used" in payload) return "copilot";
  return "claude";
}
