#!/bin/bash
# analyze-all-repos.sh
# Analyzes all auth plugin repos and categorizes them

set -e

PROJECT_DIR="/home/sephiroth/.config/opencode/opencode-auth-monster"
REFS_DIR="$PROJECT_DIR/references"
OUTPUT_DIR="$PROJECT_DIR/analysis"
PROMPT_FILE="$PROJECT_DIR/prompts/categorize-repo.md"

# Categories to detect
declare -A CATEGORIES=(
  ["antigravity"]="antigravity"
  ["windsurf"]="windsurf|codeium|vibe"
  ["cursor"]="cursor"
  ["gemini"]="gemini|google"
  ["openai"]="openai|codex|chatgpt"
  ["anthropic"]="anthropic|claude|clauddy"
  ["kiro"]="kiro|iflow|amazon"
  ["qwen"]="qwen|alibaba"
  ["copilot"]="copilot|github"
  ["multi"]="multi|sync|provider"
  ["other"]="puter|rovodev|aicodewith|occp"
)

mkdir -p "$OUTPUT_DIR"

echo "=== OpenCode Auth Monster - Repo Analysis ==="
echo "Analyzing $(ls -1 $REFS_DIR | wc -l) repositories..."
echo ""

# Quick categorization based on repo name
echo "## Quick Category Mapping" > "$OUTPUT_DIR/categories.md"
echo "" >> "$OUTPUT_DIR/categories.md"

for category in "${!CATEGORIES[@]}"; do
  pattern="${CATEGORIES[$category]}"
  echo "### $category" >> "$OUTPUT_DIR/categories.md"
  ls -1 "$REFS_DIR" | grep -iE "$pattern" >> "$OUTPUT_DIR/categories.md" 2>/dev/null || echo "(none)" >> "$OUTPUT_DIR/categories.md"
  echo "" >> "$OUTPUT_DIR/categories.md"
done

echo "Quick categorization done! See $OUTPUT_DIR/categories.md"
echo ""
echo "Next step: Run subagent analysis for each category"
