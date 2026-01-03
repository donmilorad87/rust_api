#!/bin/bash

echo "=== Testing Avatar Endpoint ==="
echo ""

# First, sign in to get a session cookie
echo "1. Signing in to get session cookie..."
COOKIE=$(curl -s -c - -X POST http://172.28.0.10:9999/api/v1/auth/sign-in \
  -H "Content-Type: application/json" \
  -d '{"email":"djmyle@gmail.com","password":"asdqwE123~~"}' \
  | grep session | awk '{print $7}')

if [ -z "$COOKIE" ]; then
  echo "   ✗ Failed to get session cookie"
  exit 1
fi

echo "   ✓ Got session cookie: ${COOKIE:0:20}..."
echo ""

# Test avatar endpoint
echo "2. Testing avatar endpoint with variant=small..."
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -b "session=$COOKIE" \
  "http://172.28.0.10:9999/api/v1/avatar/b787e056-2fb5-4aa4-8486-ab3fd1534bea?variant=small")

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | head -n -1)

echo "   HTTP Status: $HTTP_CODE"

if [ "$HTTP_CODE" != "200" ]; then
  echo "   Response body:"
  echo "$BODY" | head -20
else
  # Count bytes returned
  BYTES=$(echo "$BODY" | wc -c)
  echo "   ✓ Avatar loaded successfully (${BYTES} bytes)"
fi

echo ""
echo "3. Testing without variant parameter..."
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -b "session=$COOKIE" \
  "http://172.28.0.10:9999/api/v1/avatar/b787e056-2fb5-4aa4-8486-ab3fd1534bea")

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
echo "   HTTP Status: $HTTP_CODE"

if [ "$HTTP_CODE" != "200" ]; then
  BODY=$(echo "$RESPONSE" | head -n -1)
  echo "   Response body:"
  echo "$BODY" | head -20
else
  BYTES=$(echo "$RESPONSE" | head -n -1 | wc -c)
  echo "   ✓ Avatar loaded successfully (${BYTES} bytes)"
fi
