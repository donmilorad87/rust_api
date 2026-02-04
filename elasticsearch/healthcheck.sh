#!/bin/bash
# ============================================================================
# Elasticsearch Health Check Script
# ============================================================================
#
# Checks:
# 1. Elasticsearch HTTP endpoint responds
# 2. Cluster health is green or yellow
#
# Exit codes:
#   0 = healthy
#   1 = unhealthy
# ============================================================================

set -e

ES_HOST="${ELASTICSEARCH_HOST:-localhost}"
ES_PORT="${ELASTICSEARCH_PORT:-9200}"
ES_URL="http://${ES_HOST}:${ES_PORT}"

# Check if Elasticsearch is responding
if ! curl -s "${ES_URL}" > /dev/null 2>&1; then
    echo "Elasticsearch is not responding at ${ES_URL}"
    exit 1
fi

# Check cluster health
HEALTH_RESPONSE=$(curl -s "${ES_URL}/_cluster/health" 2>/dev/null)

if [ -z "$HEALTH_RESPONSE" ]; then
    echo "Failed to get cluster health"
    exit 1
fi

# Extract status using grep (works without jq)
STATUS=$(echo "$HEALTH_RESPONSE" | grep -oP '"status"\s*:\s*"\K[^"]+')

if [ "$STATUS" = "green" ] || [ "$STATUS" = "yellow" ]; then
    echo "Elasticsearch is healthy (status: $STATUS)"
    exit 0
else
    echo "Elasticsearch cluster is unhealthy (status: $STATUS)"
    exit 1
fi
