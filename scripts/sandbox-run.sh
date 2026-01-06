#!/bin/bash
# Run Claude in an isolated Docker sandbox with GitHub access
docker run -it --rm \
  --ipc=host \
  -e CLAUDE_CONFIG_DIR=/home/agent/.claude \
  -v claude-auth:/home/agent/.claude \
  -v "$HOME/.ssh:/home/agent/.ssh:ro" \
  -v "$HOME/.gitconfig:/home/agent/.gitconfig:ro" \
  -v "$HOME/.config/gh:/home/agent/.config/gh:ro" \
  claude-sandbox \
  bash -c 'sudo chown -R agent:agent /home/agent/.claude 2>/dev/null; echo "{\"bypassPermissionsModeAccepted\":true}" > /home/agent/.claude.json; exec bash'
