#!/bin/bash
# Run Claude in an isolated Docker sandbox with GitHub access
# Container is persistent - changes survive between sessions

set -e

CONTAINER_NAME="claude-sandbox"
IMAGE_NAME="claude-sandbox"

# Check if container exists
container_exists() {
  docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"
}

# Check if container is running
container_running() {
  docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"
}

# Create the container (background, stays alive)
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

  # Set up claude config
  docker exec "$CONTAINER_NAME" bash -c 'sudo chown -R agent:agent /home/agent/.claude 2>/dev/null; echo "{\"bypassPermissionsModeAccepted\":true}" > /home/agent/.claude.json'
  echo "Container created."
}

# Main logic
if ! container_exists; then
  create_container
elif ! container_running; then
  echo "Starting stopped container: $CONTAINER_NAME"
  docker start "$CONTAINER_NAME"
fi

# Exec into the container interactively
echo "Connecting to container: $CONTAINER_NAME"
docker exec -it "$CONTAINER_NAME" bash
