# Quickstart: see a gate row

Prerequisites: macOS or Linux, Node 18+, this clone.

1. Make a repository with a linked worktree and a slow hook:

   ```bash
   cd "$(mktemp -d)" && git init -q main && cd main && git commit -q --allow-empty -m init
   git worktree add -q ../wt -b side
   printf '#!/bin/sh\nsleep 30\n' > .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
   ```

2. Start a commit in the linked worktree: `(cd ../wt && git commit -q --allow-empty -m x) &`

3. From the main checkout, render twice (the first redraw starts the lookup):

   ```bash
   echo '{"workspace":{"current_dir":"'"$PWD"'"}}' | node <clone>/bin/cli.js render; sleep 2
   echo '{"workspace":{"current_dir":"'"$PWD"'"}}' | node <clone>/bin/cli.js render
   ```

   Expected: after the bar, a row with `pre-commit`, `wt`, `side`, `sleep 30` and its age.

4. After the commit finishes, render again: the row is gone.

5. Lock: `mkdir .git/gates.lock && echo $$ > .git/gates.lock/pid`, render twice, and a
   `gates.sh` row for `main` appears; `rm -r .git/gates.lock` and it goes.
