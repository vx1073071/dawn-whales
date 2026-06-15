#!/bin/bash
# Initialize 14 agent workspaces from main repository
# Run this from the tradingeasy directory

set -e

MAIN_REPO="$HOME/.easyclaw/workspace/tradingeasy"
WORKSPACE_ROOT="$HOME/.easyclaw/workspace"
AGENTS=(
  agent-market agent-account agent-history
  agent-futu agent-intl
  agent-strategy agent-risk agent-exec agent-auto
  agent-ui-trade agent-ui-mon agent-ui-config
  agent-qa agent-devops
)

echo "=========================================="
echo "Initializing 14 Agent Workspaces"
echo "=========================================="

for agent in "${AGENTS[@]}"; do
  echo ""
  echo "----------------------------------------"
  echo "Initializing $agent..."
  echo "----------------------------------------"

  AGENT_DIR="$WORKSPACE_ROOT/$agent"

  # Remove existing directory
  if [ -d "$AGENT_DIR" ]; then
    echo "Cleaning existing $agent..."
    rm -rf "$AGENT_DIR"
  fi

  # Clone from main repo
  echo "Cloning source code..."
  mkdir -p "$AGENT_DIR"
  cd "$MAIN_REPO"
  git archive HEAD | tar -x -C "$AGENT_DIR"

  # Remove build artifacts
  rm -rf "$AGENT_DIR/node_modules"
  rm -rf "$AGENT_DIR/dist"
  rm -rf "$AGENT_DIR/out"

  # Initialize git and create agent branch
  cd "$AGENT_DIR"
  git init
  git add .
  git commit -m "Initial commit for $agent"
  git checkout -b "$agent"

  # Create agent identity file
  echo "{ \"agentId\": \"$agent\", \"role\": \"$agent\" }" > agent-config.json

  echo "$agent initialized successfully!"
done

echo ""
echo "=========================================="
echo "All 14 workspaces initialized!"
echo "Next steps:"
echo "  1. Run npm install in each workspace"
echo "  2. Use scripts/start-all-agents.sh to launch"
echo "=========================================="
