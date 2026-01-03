#!/bin/bash

echo "=== Testing Avatar Endpoint with JWT ==="
echo ""

# Sign in to get JWT token
echo "1. Signing in to get JWT token..."
RESPONSE=$(curl -s -X POST http://172.28.0.10:9999/api/v1/auth/sign-in \
  -H "Content-Type: application/json" \
  -d '{"email":"djmyle@gmail.com","password":"asdqwE123~~"}')

TOKEN=$(echo "$RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "   ✗ Failed to get JWT token"
  echo "   Response: $RESPONSE"
  exit 1
fi

echo "   ✓ Got JWT token: ${TOKEN:0:30}..."
echo ""

# Test avatar endpoint with variant=small
echo "2. Testing avatar endpoint with variant=small..."
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" \
  "http://172.28.0.10:9999/api/v1/avatar/b787e056-2fb5-4aa4-8486-ab3fd1534bea?variant=small" \
  -o /tmp/claude/avatar_test.jpg 2>&1

if [ -f /tmp/claude/avatar_test.jpg ]; then
  SIZE=$(stat -f%z /tmp/claude/avatar_test.jpg 2>/dev/null || stat -c%s /tmp/claude/avatar_test.jpg 2>/dev/null)
  echo "Downloaded avatar size: $SIZE bytes"

  if [ "$SIZE" -gt 100 ]; then
    echo "✓ Avatar downloaded successfully"
  else
    echo "✗ Avatar file too small, might be an error response"
    cat /tmp/claude/avatar_test.jpg
  fi
fi

echo ""
echo "3. Testing without variant parameter..."
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" \
  "http://172.28.0.10:9999/api/v1/avatar/b787e056-2fb5-4aa4-8486-ab3fd1534bea" \
  -o /tmp/claude/avatar_test2.jpg 2>&1

if [ -f /tmp/claude/avatar_test2.jpg ]; then
  SIZE=$(stat -f%z /tmp/claude/avatar_test2.jpg 2>/dev/null || stat -c%s /tmp/claude/avatar_test2.jpg 2>/dev/null)
  echo "Downloaded avatar size: $SIZE bytes"

  if [ "$SIZE" -gt 100 ]; then
    echo "✓ Avatar downloaded successfully"
  else
    echo "✗ Avatar file too small, might be an error response"
    cat /tmp/claude/avatar_test2.jpg
  fi
fi
