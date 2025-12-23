FROM grafana/grafana:latest

USER root

# Copy provisioning configurations
COPY provisioning /etc/grafana/provisioning
COPY dashboards /var/lib/grafana/dashboards

# Fix permissions for grafana user (uid 472)
RUN chown -R 472:472 /etc/grafana/provisioning && \
    chown -R 472:472 /var/lib/grafana/dashboards

USER 472

# Set environment defaults
ENV GF_SECURITY_ADMIN_USER=admin
ENV GF_SECURITY_ADMIN_PASSWORD=admin
ENV GF_USERS_ALLOW_SIGN_UP=false

EXPOSE 3000
