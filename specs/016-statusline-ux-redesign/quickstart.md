# Quickstart: Statusline Redesign Validation

## Test Scenarios

### Scenario 1: Single Developer (No Agents)

```bash
# Setup
cd ~/any-git-repo
export CLAUDE_STATUSLINE_PAYLOAD_PATH=/tmp/payload.json

# Create minimal payload
cat > /tmp/payload.json << 'EOF'
{
  "workspace": {"current_dir": ".", "project_dir": null, "repo": "my-project"},
  "session_name": "main",
  "model": {"id": "claude-opus-5", "display_name": "Opus 5"},
  "effort": {"level": "high"}
}
EOF

# Render
node bin/cli.js render

# Expect:
# Line 1: folder, branch, status
# Line 2: skill (e.g., spell-check), idle status
# Line 3: model, effort
# Line 4: context usage, RTK savings
```

### Scenario 2: Multi-Agent (2+ agents)

```bash
# Create payload with agents
cat > /tmp/payload.json << 'EOF'
{
  "workspace": {"current_dir": ".", "repo": "statusline"},
  "session_name": "main",
  "model": {"display_name": "Opus 5"},
  "effort": {"level": "high"},
  "activeAgents": [
    {"id": "A", "name": "code-review", "skills": ["code-review", "security"], "status": "running"},
    {"id": "B", "name": "test", "skills": ["test", "debug"], "status": "running"}
  ]
}
EOF

# Render
node bin/cli.js render

# Expect:
# Line 2: 🔵 working · ← 2 agents  🧩 Agente-code-review: code-review, security; Agente-test: test
```

### Scenario 3: PR Active + Unmerged

```bash
# Git setup
git checkout -b feature/test
git add .
git commit -m "test"
git status --porcelain

# Render with PR info
node bin/cli.js render

# Expect:
# Line 1: Shows PR status, unmerged indicator if conflicts
```

## Visual Checks

- [ ] Line 1 shows folder, branch, file status clearly
- [ ] Line 2 shows agent names with skills (when present)
- [ ] Line 3 shows model, effort, features
- [ ] Line 4 shows context and token info
- [ ] All Nerd Font icons render properly
- [ ] No text wrapping on 120-column terminal
- [ ] Graceful degradation on 80-column terminal
- [ ] Activity transitions smoothly (working ↔ idle)
