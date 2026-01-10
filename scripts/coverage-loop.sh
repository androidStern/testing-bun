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
CONTAINER_NAME="claude-sandbox"
IMAGE_NAME="claude-sandbox"

if [ ! -f "$PROGRESS_FILE" ]; then
  echo "# Test Coverage Progress" >"$PROGRESS_FILE"
  echo "# Started: $(date)" >>"$PROGRESS_FILE"
  echo "" >>"$PROGRESS_FILE"
fi

read -r -d '' PROMPT <<'EOF' || true
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
   Consult test-coverage-progress.txt whenever you need more context about our past work on this feature.
3. Ask yourself, how SHOULD this feature work (infer from app logic and common sense, assuming theres no bugs). Write ONE meaningful test that validates the feature works correctly for users.
   Make sure the test has no bugs by running it and observing it passes. Failures due to application code bugs are ok but note them with comments.
4. Run bun run coverage again - coverage should increase as a side effect of testing real behavior.
5. Commit with message: test(<file>): <describe the user behavior being tested>
6. Append super-concise notes to test-coverage-progress.txt: what you tested, coverage %, any learnings.

UNBREAKABLE RULES:
- Don't touch application code. Only write tests.
- Let real failures fail: If tests fail becasue of a legitimate bug, leave the test as failing and move on. Only fix tests if the test itself is broken.
- No reward hacking: dont delete tests just to get less failures, dont comment out or skip tests without good reason, don't add bandaids or logic aimed soley at making a test pass at the expense of its integrity.
- NEVER, under any circumstances, push local changes. You are permitted to commit code locally but you may NOT push code.

ONLY WRITE ONE TEST PER ITERATION.
If statement coverage reaches 90%, output <complete>DONE</complete>.
EOF

TMPFILE=$(mktemp)
trap "rm -f $TMPFILE" EXIT

JQ_FILTER='
select(.type=="assistant") 
| .message.content[]? 
| if .type=="text" then "\n\(.text)\n"
  elif .type=="tool_use" then "\u001b[36m→ \(.name)\u001b[0m"
  else empty end
'

container_exists() {
  docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"
}

container_running() {
  docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"
}

create_container() {
  echo "Creating persistent container: $CONTAINER_NAME"
  docker run -d \
    --name "$CONTAINER_NAME" \
    --ipc=host \
    -e CLAUDE_CONFIG_DIR=/home/agent/.claude \
    -v claude-auth:/home/agent/.claude \
    -v "$HOME/.ssh:/home/agent/.ssh:ro" \
    -v "$HOME/.gitconfig:/home/agent/.gitconfig:ro" \
    -v "$HOME/.config/gh:/home/agent/.config/gh:ro" \
    "$IMAGE_NAME" \
    tail -f /dev/null

  docker exec "$CONTAINER_NAME" bash -c 'sudo chown -R agent:agent /home/agent/.claude 2>/dev/null; echo "{\"bypassPermissionsModeAccepted\":true}" > /home/agent/.claude.json'
  echo "Container created."
}

ensure_container_running() {
  if ! container_exists; then
    create_container
  elif ! container_running; then
    echo "Starting stopped container: $CONTAINER_NAME"
    docker start "$CONTAINER_NAME"
  fi
}

ensure_container_running

for ((i = 1; i <= $ITERATIONS; i++)); do
  echo "=== Iteration $i of $ITERATIONS ==="

  docker exec \
    -e CLAUDE_PROMPT="$PROMPT" \
    "$CONTAINER_NAME" \
    bash -c 'claude --dangerously-skip-permissions --verbose --output-format stream-json -p "$CLAUDE_PROMPT"' |
    tee "$TMPFILE" |
    jq --unbuffered -rj "$JQ_FILTER"

  result=$(cat "$TMPFILE")

  if [[ "$result" == *"<complete>DONE</complete>"* ]]; then
    echo ""
    echo "=== Target coverage reached after $i iterations ==="
    exit 0
  fi

  echo ""
done

echo "=== Completed $ITERATIONS iterations ==="
echo "Container '$CONTAINER_NAME' is still running. Connect with: docker exec -it $CONTAINER_NAME bash"
