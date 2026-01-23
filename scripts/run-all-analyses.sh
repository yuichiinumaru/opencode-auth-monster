#!/bin/bash
# run-all-analyses.sh
# Launches parallel subagent analysis for all categories

set -e

PROJECT_DIR="/home/sephiroth/.config/opencode/opencode-auth-monster"
REFS_DIR="$PROJECT_DIR/references"
OUTPUT_DIR="$PROJECT_DIR/analysis"
MODEL="opencode/glm-4.7-free"

mkdir -p "$OUTPUT_DIR/raw"

# Categories and their repos
declare -A CATEGORIES
CATEGORIES["antigravity"]="antigravity-auth arjunnai-opencode-antigravity-auth opencode-antigravity-auth opencode-antigravity-autopilot"
CATEGORIES["gemini"]="opencode-gemini-auth opencode-gemini-auth-swap opencode-google-auth shantur-opencode-gemini-auth"
CATEGORIES["anthropic"]="opencode-anthropic-auth opencode-anthropic-auth-dynamic opencode-clauddy-auth"
CATEGORIES["qwen"]="opencode-qwen-auth opencode_qwen_auth qwen-auth-opencode selcukcift-opencode-qwen-auth"
CATEGORIES["cursor"]="cursor-opencode-auth opencode-cursor-auth yet-another-opencode-cursor-auth"
CATEGORIES["windsurf"]="opencode-windsurf-auth vibe-open-auth vibe-open-auth-old"
CATEGORIES["openai"]="ai-opencode-chatgpt-auth anashshaki-opencode-openai-codex-auth opencode-chatgpt-auth opencode-codex-auth opencode-openai-codex-auth opencode-openai-codex-auth-multi opencode-openai-multi-auth"
CATEGORIES["kiro"]="Indosaram-opencode-kiro-auth opencode-iflow-auth opencode-kiro-auth"
CATEGORIES["other"]="occp-proxy opencode-aicodewith-auth opencode-puter-auth opencode-rovodev-auth opencode-copilot-auth"

echo "=== Auth Monster Deep Analysis ==="
echo "Model: $MODEL"
echo "Starting $(date)"
echo ""

analyze_category() {
    local category="$1"
    local repos="$2"
    local output_file="$OUTPUT_DIR/raw/${category}.md"
    
    echo "[$category] Starting analysis..."
    
    # Build granular prompt
    local prompt="# TASK: Analyze OpenCode Auth Plugins - Category: $category

## YOUR MISSION
You are analyzing $category auth plugins for OpenCode. Be EXTREMELY thorough.

## REPOS TO ANALYZE (in $REFS_DIR/)
$repos

## STEP 1: For EACH repo, extract this info

### 1.1 Read package.json
- Find: name, version, main/module entry point
- List: dependencies (only auth-related ones)

### 1.2 Read the main source file (src/index.ts or similar)
- What auth mechanism? (API key / OAuth / Cookie scraping / Local proxy)
- What external service? (e.g., Anthropic API, Cursor servers, etc.)
- Does it spawn a local server? What port?

### 1.3 Read README.md
- How to configure?
- Any known issues mentioned?

## STEP 2: Rate each repo (1-10 scale, be honest)

| Repo | Code Quality | Docs | Features | Last Update |
|------|--------------|------|----------|-------------|
| ... | X/10 | X/10 | X/10 | date |

## STEP 3: Identify the BEST repo to use as base

- Which has cleanest code?
- Which has most features?
- Which is most maintained?

## STEP 4: What to port from other repos?

List specific features from non-base repos worth porting.

## OUTPUT FORMAT
Use markdown. Be concise but complete. Start with a summary table.

GO!"

    # Run opencode in non-interactive mode
    echo "$prompt" | opencode run --model "$MODEL" > "$output_file" 2>&1 || echo "[$category] Failed"
    
    echo "[$category] Done -> $output_file"
}

# Run all categories in parallel
for category in "${!CATEGORIES[@]}"; do
    analyze_category "$category" "${CATEGORIES[$category]}" &
done

echo "All analyses launched in parallel. Waiting..."
wait

echo ""
echo "=== All Done! ==="
echo "Results in: $OUTPUT_DIR/raw/"
ls -la "$OUTPUT_DIR/raw/"
