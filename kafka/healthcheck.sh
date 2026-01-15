#!/bin/sh
set -e

KAFKA_PORT="${KAFKA_PORT:-9092}"

/opt/kafka/bin/kafka-broker-api-versions.sh --bootstrap-server "localhost:${KAFKA_PORT}" >/dev/null 2>&1

topics=$(/opt/kafka/bin/kafka-topics.sh --list --bootstrap-server "localhost:${KAFKA_PORT}")

for topic in \
  user.events \
  auth.events \
  transaction.events \
  category.events \
  system.events \
  events.dead_letter \
  checkout.commands \
  checkout.events \
  chat.commands \
  chat.events \
  games.commands \
  games.events \
  gateway.presence; do
  echo "$topics" | grep -Fxq "$topic" || exit 1
done
