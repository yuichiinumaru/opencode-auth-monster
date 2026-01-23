#!/bin/bash
# analyze-single-category.sh
# Analyzes a single category of auth plugins

CATEGORY="${1:-gemini}"
PROJECT_DIR="/home/sephiroth/.config/opencode/opencode-auth-monster"
REFS_DIR="$PROJECT_DIR/references"
OUTPUT_DIR="$PROJECT_DIR/analysis"
MODEL="opencode/glm-4.7-free"

mkdir -p "$OUTPUT_DIR/reports"

# Get repos for category
case "$CATEGORY" in
  "antigravity") REPOS="antigravity-auth arjunnai-opencode-antigravity-auth opencode-antigravity-auth opencode-antigravity-autopilot" ;;
  "gemini") REPOS="opencode-gemini-auth opencode-gemini-auth-swap opencode-google-auth shantur-opencode-gemini-auth" ;;
  "anthropic") REPOS="opencode-anthropic-auth opencode-anthropic-auth-dynamic opencode-clauddy-auth" ;;
  "qwen") REPOS="opencode-qwen-auth opencode_qwen_auth qwen-auth-opencode selcukcift-opencode-qwen-auth" ;;
  "cursor") REPOS="cursor-opencode-auth opencode-cursor-auth yet-another-opencode-cursor-auth" ;;
  "windsurf") REPOS="opencode-windsurf-auth vibe-open-auth vibe-open-auth-old" ;;
  "openai") REPOS="opencode-chatgpt-auth opencode-codex-auth opencode-openai-codex-auth opencode-openai-codex-auth-multi opencode-openai-multi-auth" ;;
  "kiro") REPOS="Indosaram-opencode-kiro-auth opencode-iflow-auth opencode-kiro-auth" ;;
  *) REPOS="occp-proxy opencode-aicodewith-auth opencode-puter-auth opencode-rovodev-auth opencode-copilot-auth" ;;
esac

echo "=== Analyzing: $CATEGORY ==="
echo "Repos: $REPOS"
echo "Model: $MODEL"
echo ""

# Create the prompt
MESSAGE="Analyze these OpenCode auth plugins in $REFS_DIR:

$REPOS

For EACH repo:
1. cat package.json - get name, version, dependencies
2. cat src/index.ts or main entry - identify auth mechanism
3. cat README.md - get setup instructions

Then create a comparison table:
| Repo | Auth Type | Service | Quality (1-10) |

Finally recommend which is the BEST to fork as base.

Be thorough. Start now."

cd "$PROJECT_DIR"
opencode run --model "$MODEL" "$MESSAGE" 2>&1 | tee "$OUTPUT_DIR/reports/${CATEGORY}_report.md"

echo ""
echo "=== Done: $CATEGORY ==="
