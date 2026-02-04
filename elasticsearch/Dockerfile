FROM docker.elastic.co/elasticsearch/elasticsearch:8.11.0

# Build arguments from docker-compose
ARG ELASTICSEARCH_PORT
ARG ELASTICSEARCH_HEAP_SIZE

USER root

# Set environment variables
ENV ELASTICSEARCH_PORT=${ELASTICSEARCH_PORT:-9200}
ENV ES_JAVA_OPTS="-Xms${ELASTICSEARCH_HEAP_SIZE:-512m} -Xmx${ELASTICSEARCH_HEAP_SIZE:-512m}"

# Cluster configuration
ENV discovery.type=single-node
ENV xpack.security.enabled=false
ENV xpack.security.enrollment.enabled=false
ENV cluster.name=blazing-sun-cluster
ENV node.name=elasticsearch-node-1

# Performance tuning
ENV bootstrap.memory_lock=true
ENV indices.memory.index_buffer_size=20%
ENV indices.queries.cache.size=20%

# Disable ML features (reduces memory usage)
ENV xpack.ml.enabled=false

# Copy configuration files
COPY --chmod=644 elasticsearch.yml /usr/share/elasticsearch/config/elasticsearch.yml
COPY --chmod=755 entrypoint.sh /custom-entrypoint.sh
COPY --chmod=755 healthcheck.sh /usr/local/bin/elasticsearch-healthcheck.sh

# Create data directory with proper permissions
RUN mkdir -p /usr/share/elasticsearch/data && \
    chown -R elasticsearch:elasticsearch /usr/share/elasticsearch/data

VOLUME /usr/share/elasticsearch/data

EXPOSE 9200 9300

USER elasticsearch

ENTRYPOINT ["/custom-entrypoint.sh"]
