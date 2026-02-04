#!/bin/bash
set -e

# ============================================================================
# Elasticsearch Entrypoint Script
# ============================================================================

echo "=============================================="
echo "  Elasticsearch Container Starting"
echo "=============================================="
echo ""

# Display configuration
echo "Configuration:"
echo "  - Cluster Name: ${cluster.name:-blazing-sun-cluster}"
echo "  - Node Name: ${node.name:-elasticsearch-node-1}"
echo "  - HTTP Port: ${http.port:-9200}"
echo "  - Transport Port: ${transport.port:-9300}"
echo "  - Heap Size: ${ES_JAVA_OPTS}"
echo "  - Discovery Type: single-node"
echo "  - Security: disabled"
echo ""

# Check data directory permissions
DATA_DIR="/usr/share/elasticsearch/data"
if [ -d "$DATA_DIR" ]; then
    echo "Data directory exists: $DATA_DIR"
    ls -la "$DATA_DIR" 2>/dev/null || true
else
    echo "Creating data directory: $DATA_DIR"
    mkdir -p "$DATA_DIR"
fi

# Set JVM options if not already set
if [ -z "$ES_JAVA_OPTS" ]; then
    export ES_JAVA_OPTS="-Xms512m -Xmx512m"
    echo "Setting default JVM options: $ES_JAVA_OPTS"
fi

echo ""
echo "Starting Elasticsearch..."
echo "=============================================="
echo ""

# Execute the original entrypoint
exec /usr/local/bin/docker-entrypoint.sh elasticsearch
