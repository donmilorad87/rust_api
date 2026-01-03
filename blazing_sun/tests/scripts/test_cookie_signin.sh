#!/bin/bash

echo "=== Testing Cookie-Based Sign In ==="
echo ""

# Sign in and capture full response including headers
echo "1. Signing in and capturing cookies..."
RESPONSE=$(curl -v -X POST http://172.28.0.10:9999/api/v1/auth/sign-in \
  -H "Content-Type: application/json" \
  -d '{"email":"djmyle@gmail.com","password":"asdqwE123~~"}' \
  -c /tmp/cookies.txt \
  2>&1)

echo "$RESPONSE" | grep -i "set-cookie"
echo ""

echo "2. Cookies saved to /tmp/cookies.txt:"
cat /tmp/cookies.txt
echo ""

# Test avatar endpoint with cookie
echo "3. Testing avatar endpoint with cookie from file..."
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -b /tmp/cookies.txt \
  "http://172.28.0.10:9999/api/v1/avatar/2afd1f5d-1076-4f3b-aafc-372bd8314759?variant=small" \
  -o /tmp/claude/avatar_cookie_test.jpg 2>&1

if [ -f /tmp/claude/avatar_cookie_test.jpg ]; then
  SIZE=$(stat -c%s /tmp/claude/avatar_cookie_test.jpg 2>/dev/null)
  echo "Downloaded avatar size: $SIZE bytes"

  if [ "$SIZE" -gt 100 ]; then
    echo "✓ Avatar downloaded successfully with cookie authentication"
  else
    echo "✗ Avatar file too small, might be an error response"
    cat /tmp/claude/avatar_cookie_test.jpg
  fi
fi

echo ""
echo "4. Testing profile page with cookie..."
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -b /tmp/cookies.txt \
  "http://172.28.0.10:9999/profile" \
  | grep -A 5 "avatarContainer"
