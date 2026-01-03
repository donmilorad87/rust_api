#!/bin/bash
set -e

echo "============================================"
echo "Starting Kafka UI"
echo "============================================"
echo ""
echo "Configuration:"
echo "  Cluster Name: ${KAFKA_CLUSTERS_0_NAME}"
echo "  Bootstrap Servers: ${KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS}"
echo "  Context Path: ${SERVER_SERVLET_CONTEXT_PATH}"
echo ""

# Execute the default entrypoint
exec java $JAVA_OPTS -jar /kafka-ui-api.jar
