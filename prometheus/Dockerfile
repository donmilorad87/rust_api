FROM prom/prometheus:latest

USER root
COPY prometheus.yml /etc/prometheus/prometheus.yml
RUN chown nobody:nobody /etc/prometheus/prometheus.yml
USER nobody

EXPOSE 9090

CMD ["--config.file=/etc/prometheus/prometheus.yml", "--storage.tsdb.path=/prometheus", "--web.enable-lifecycle", "--web.external-url=/prometheus/"]
