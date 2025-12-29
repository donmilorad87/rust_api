#!/bin/bash
# Agent Color Output Hook
# Adds colored prefixes based on active skill/agent

# Color definitions (ANSI escape codes)
# Standard colors: 30=Black, 31=Red, 32=Green, 33=Yellow, 34=Blue, 35=Magenta, 36=Cyan, 37=White
# Bright colors: 90=Gray, 91=Bright Red, 92=Bright Green, 93=Bright Yellow, 94=Bright Blue, 95=Bright Magenta, 96=Bright Cyan, 97=Bright White
# 256-color: 38;5;XXX where XXX is 0-255
declare -A AGENT_COLORS=(
    ["backend"]="34"              # Blue
    ["frontend"]="35"             # Magenta
    ["database"]="33"             # Yellow
    ["tester"]="32"               # Green
    ["review_security"]="38;5;208"  # Orange (256-color)
    ["security"]="38;5;208"         # Orange (256-color)
    ["security-review"]="38;5;208"  # Orange (256-color)
    ["docs"]="36"                 # Cyan
    ["docs_writer"]="36"          # Cyan
    ["update_readme_and_claude_mds"]="96"  # Bright Cyan
    ["dockerizator"]="38;5;39"    # Deep Sky Blue (256-color)
    ["docker"]="38;5;39"          # Deep Sky Blue (256-color)
    ["orchestrator"]="38;5;129"   # Purple (256-color)
)

declare -A AGENT_ICONS=(
    ["backend"]="[BE]"
    ["frontend"]="[FE]"
    ["database"]="[DB]"
    ["tester"]="[TEST]"
    ["review_security"]="[SEC]"
    ["security"]="[SEC]"
    ["security-review"]="[SEC]"
    ["docs"]="[DOCS]"
    ["docs_writer"]="[DOCS]"
    ["update_readme_and_claude_mds"]="[README]"
    ["dockerizator"]="[DK]"
    ["docker"]="[DK]"
    ["orchestrator"]="[ORCH]"
)

# Read input from stdin
input=$(cat)

# Extract skill name from the hook context
skill_name=$(echo "$input" | jq -r '.tool_input.skill // empty' 2>/dev/null)

if [ -n "$skill_name" ] && [ "${AGENT_COLORS[$skill_name]+isset}" ]; then
    color_code="${AGENT_COLORS[$skill_name]}"
    icon="${AGENT_ICONS[$skill_name]}"

    # Output colored prefix
    printf '\033[1;%sm%s\033[0m ' "$color_code" "$icon"
fi

# Pass through - hook doesn't block
exit 0