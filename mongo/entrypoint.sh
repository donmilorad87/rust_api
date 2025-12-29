#!/bin/bash
set -e

# This script runs on first MongoDB initialization
# It creates the application database and user

echo "=== MongoDB Initialization Script ==="
echo "Creating database: ${MONGO_INITDB_DATABASE}"
echo "Creating user: ${MONGO_USER}"

# Create application user with readWrite permissions on the app database
mongosh <<EOF
use ${MONGO_INITDB_DATABASE}

db.createUser({
  user: "${MONGO_USER}",
  pwd: "${MONGO_PASSWORD}",
  roles: [
    { role: "readWrite", db: "${MONGO_INITDB_DATABASE}" },
    { role: "dbAdmin", db: "${MONGO_INITDB_DATABASE}" }
  ]
})

// Create initial collections (optional)
db.createCollection("logs")
db.createCollection("sessions")
db.createCollection("analytics")

print("=== MongoDB initialization complete ===")
EOF
