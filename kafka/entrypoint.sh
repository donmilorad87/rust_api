#!/bin/bash
set -e

echo "============================================"
echo "Starting Kafka in KRaft mode (no Zookeeper)"
echo "============================================"
echo ""
echo "Configuration:"
echo "  Node ID: ${KAFKA_NODE_ID:-1}"
echo "  Broker Port: ${KAFKA_PORT:-9092}"
echo "  Controller Port: ${KAFKA_CONTROLLER_PORT:-9093}"
echo "  Listeners: ${KAFKA_LISTENERS}"
echo "  Advertised Listeners: ${KAFKA_ADVERTISED_LISTENERS}"
echo "  Auto Create Topics: ${KAFKA_AUTO_CREATE_TOPICS_ENABLE}"
echo "  Default Partitions: ${KAFKA_NUM_PARTITIONS}"
echo ""

# Function to create topics after Kafka is ready
create_topics() {
    echo "Waiting for Kafka to be ready..."
    sleep 10

    # Wait until Kafka is accepting connections
    until /opt/kafka/bin/kafka-broker-api-versions.sh --bootstrap-server localhost:${KAFKA_PORT:-9092} > /dev/null 2>&1; do
        echo "Kafka not ready yet, waiting..."
        sleep 2
    done

    echo "Creating application topics..."

    # Core application topics
    TOPICS="user.events auth.events transaction.events category.events system.events events.dead_letter"

    # Checkout topics
    CHECKOUT_TOPICS="checkout.requests checkout.finished"

    # WebSocket Gateway topics (chat and games)
    WS_TOPICS="chat.commands chat.events games.commands games.events gateway.presence"

    # Game-specific topics for checkout service
    GAME_TOPICS="bigger_dice.participation_payed bigger_dice.win_prize tic_tac_toe.participation_payed tic_tac_toe.win_prize tic_tac_toe.match_cancelled"

    TOPICS="$TOPICS $CHECKOUT_TOPICS $WS_TOPICS $GAME_TOPICS"

    for TOPIC in $TOPICS; do
        echo "Creating topic: $TOPIC"
        /opt/kafka/bin/kafka-topics.sh --create \
            --bootstrap-server localhost:${KAFKA_PORT:-9092} \
            --topic "$TOPIC" \
            --partitions ${KAFKA_NUM_PARTITIONS:-3} \
            --replication-factor 1 \
            --if-not-exists
    done

    echo "All topics created successfully!"
    /opt/kafka/bin/kafka-topics.sh --list --bootstrap-server localhost:${KAFKA_PORT:-9092}
}

# Start topic creation in background
create_topics &

# Use the default Apache Kafka entrypoint
exec /etc/kafka/docker/run
