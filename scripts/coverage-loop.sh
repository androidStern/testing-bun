#!/bin/bash
# Coverage improvement loop for Claude in Docker sandbox
#
# Usage: ./scripts/coverage-loop.sh <iterations>
#
# Prerequisites:
#   1. Build the Docker image: bun run sandbox:build
#   2. Login to Claude in the container at least once: bun run sandbox
#   3. Run this script from the project root

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  exit 1
fi

ITERATIONS=$1
PROGRESS_FILE="test-coverage-progress.txt"

# Initialize progress file if it doesn't exist
if [ ! -f "$PROGRESS_FILE" ]; then
  echo "# Test Coverage Progress" > "$PROGRESS_FILE"
  echo "# Started: $(date)" >> "$PROGRESS_FILE"
  echo "" >> "$PROGRESS_FILE"
fi

read -r -d '' PROMPT << 'EOF' || true
WHAT MAKES A GREAT TEST:
A great test covers behavior users depend on. It tests a feature that, if broken, would frustrate or block users.
It validates real workflows - not implementation details. It catches regressions before users do.
Do NOT write tests just to increase coverage. Use coverage as a guide to find UNTESTED USER-FACING BEHAVIOR.
If uncovered code is not worth testing (boilerplate, unreachable error branches, internal plumbing),
add /* istanbul ignore next */ comments instead of writing low-value tests.

THIS CODEBASE:
- React 19 + TanStack Router/Form/Query
- Convex backend (convex/ directory)
- Component tests use vitest-browser-react with Playwright
- Forms use TanStack Form with Zod validation
- Focus on: form submissions, user interactions, error states users will see

PROCESS:
1. Run bun run coverage to see which files have low coverage.
2. Read the uncovered lines and identify the most important USER-FACING FEATURE that lacks tests.
   Prioritize: form validation, user interactions, error handling users will hit, data display.
   Deprioritize: internal utilities, edge cases users won't encounter, shadcn UI components.
3. Write ONE meaningful test that validates the feature works correctly for users.
4. Run bun run coverage again - coverage should increase as a side effect of testing real behavior.
5. Commit with message: test(<file>): <describe the user behavior being tested>
6. Append super-concise notes to test-coverage-progress.txt: what you tested, coverage %, any learnings.

ONLY WRITE ONE TEST PER ITERATION.
If statement coverage reaches 90%, output <complete>DONE</complete>.
EOF

for ((i=1; i<=$ITERATIONS; i++)); do
  echo "=== Iteration $i of $ITERATIONS ==="

  result=$(docker run --rm \
    --ipc=host \
    -e CLAUDE_CONFIG_DIR=/home/agent/.claude \
    -e CLAUDE_PROMPT="$PROMPT" \
    -v claude-auth:/home/agent/.claude \
    -v "$HOME/.ssh:/home/agent/.ssh:ro" \
    -v "$HOME/.gitconfig:/home/agent/.gitconfig:ro" \
    -v "$HOME/.config/gh:/home/agent/.config/gh:ro" \
    claude-sandbox \
    bash -c 'sudo chown -R agent:agent /home/agent/.claude 2>/dev/null; echo "{\"bypassPermissionsModeAccepted\":true}" > /home/agent/.claude.json; claude --dangerously-skip-permissions -p "$CLAUDE_PROMPT"')

  echo "$result"

  if [[ "$result" == *"<complete>DONE</complete>"* ]]; then
    echo ""
    echo "=== Target coverage reached after $i iterations ==="
    exit 0
  fi

  echo ""
done

echo "=== Completed $ITERATIONS iterations ==="
