#!/bin/bash
# ============================================================================
# FIREWALL SETUP SCRIPT
# ============================================================================
#
# Purpose: Configure UFW (Uncomplicated Firewall) on Ubuntu for Blazing Sun
#          Docker infrastructure. Opens necessary ports for services while
#          maintaining security.
#
# Usage:   sudo ./firewall-setup.sh
#
# WARNING: This script modifies firewall rules. Make sure SSH (port 22) is
#          allowed BEFORE enabling UFW, or you may lose remote access!
#
# Network: This script assumes you're on a local subnet (e.g., 192.168.x.x)
#          and accessing the Ubuntu machine via SSH from another machine
#          on the same network.
#
# Docker Network: 172.28.0.0/16 (devnet)
#
# Services and Ports:
#   - SSH:        22      (remote access)
#   - HTTP:       80      (nginx reverse proxy)
#   - HTTPS:      443     (nginx SSL)
#   - Grafana:    3000    (monitoring dashboards)
#   - PostgreSQL: 5432    (database - subnet only)
#   - RabbitMQ:   5672    (message queue - subnet only)
#   - Redis:      6379    (cache - subnet only)
#   - Kafka:      9092    (event streaming - subnet only)
#   - Rust App:   9999    (backend API - subnet only)
#   - Prometheus: 9090    (metrics - subnet only)
#   - RabbitMQ UI:15672   (management console - subnet only)
#
# ============================================================================

set -e

# ----------------------------------------------------------------------------
# CONFIGURATION - Adjust these values for your network
# ----------------------------------------------------------------------------

# Your local subnet (machines that can access internal services)
# Common home networks: 192.168.0.0/24, 192.168.1.0/24, 10.0.0.0/24
LOCAL_SUBNET="192.168.0.0/24"

# Docker internal network (do not change unless you modified docker-compose.yml)
DOCKER_SUBNET="172.28.0.0/16"

# ----------------------------------------------------------------------------
# COLORS FOR OUTPUT
# ----------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ----------------------------------------------------------------------------
# HELPER FUNCTIONS
# ----------------------------------------------------------------------------

print_header() {
    echo ""
    echo -e "${GREEN}============================================${NC}"
    echo -e "${GREEN} $1${NC}"
    echo -e "${GREEN}============================================${NC}"
}

print_step() {
    echo -e "${YELLOW}→${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# ----------------------------------------------------------------------------
# CHECK ROOT PRIVILEGES
# ----------------------------------------------------------------------------

print_header "Blazing Sun - Firewall Setup"

if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}ERROR: This script must be run as root (sudo)${NC}"
    echo "Usage: sudo ./firewall-setup.sh"
    exit 1
fi

# ----------------------------------------------------------------------------
# CHECK IF UFW IS INSTALLED
# ----------------------------------------------------------------------------

print_step "Checking if UFW is installed..."

if ! command -v ufw &> /dev/null; then
    echo -e "${RED}ERROR: UFW is not installed${NC}"
    echo "Install it with: sudo apt install ufw"
    exit 1
fi

print_success "UFW is installed"

# ----------------------------------------------------------------------------
# RESET UFW TO DEFAULT STATE (OPTIONAL - COMMENTED OUT FOR SAFETY)
# ----------------------------------------------------------------------------

# Uncomment the following lines to reset UFW to default state before applying rules
# WARNING: This will remove ALL existing rules!
#
# print_step "Resetting UFW to default state..."
# ufw --force reset
# print_success "UFW reset complete"

# ----------------------------------------------------------------------------
# SET DEFAULT POLICIES
# ----------------------------------------------------------------------------

print_header "Setting Default Policies"

# Default: Deny all incoming connections (security best practice)
print_step "Setting default incoming policy to DENY..."
ufw default deny incoming
print_success "Default incoming: DENY"

# Default: Allow all outgoing connections (so server can reach internet)
print_step "Setting default outgoing policy to ALLOW..."
ufw default allow outgoing
print_success "Default outgoing: ALLOW"

# ----------------------------------------------------------------------------
# ESSENTIAL: SSH ACCESS (DO THIS FIRST!)
# ----------------------------------------------------------------------------

print_header "SSH Access (Port 22)"

# Allow SSH from anywhere - CRITICAL for remote access
# Without this, you will be locked out when UFW is enabled!
print_step "Allowing SSH (port 22) from anywhere..."
ufw allow 22/tcp comment 'SSH - Remote access'
print_success "SSH allowed from anywhere"

# ----------------------------------------------------------------------------
# PUBLIC SERVICES (Accessible from anywhere)
# ----------------------------------------------------------------------------

print_header "Public Services"

# HTTP (port 80) - Nginx reverse proxy
# Used for: Web traffic, Let's Encrypt certificate validation
print_step "Allowing HTTP (port 80)..."
ufw allow 80/tcp comment 'HTTP - Nginx reverse proxy'
print_success "HTTP allowed"

# HTTPS (port 443 TCP) - Nginx SSL
# Used for: Encrypted web traffic
print_step "Allowing HTTPS (port 443 TCP)..."
ufw allow 443/tcp comment 'HTTPS - Nginx SSL'
print_success "HTTPS TCP allowed"

# HTTPS (port 443 UDP) - HTTP/3 QUIC protocol
# Used for: Modern browsers with QUIC support for faster connections
print_step "Allowing HTTPS (port 443 UDP) for HTTP/3..."
ufw allow 443/udp comment 'HTTP/3 QUIC - Modern browsers'
print_success "HTTPS UDP (QUIC) allowed"

# Grafana (port 3000) - Monitoring dashboards
# Used for: Viewing application metrics and dashboards
# NOTE: Change to subnet-only if you don't want public access
print_step "Allowing Grafana (port 3000)..."
ufw allow 3000/tcp comment 'Grafana - Monitoring dashboards'
print_success "Grafana allowed"

# ----------------------------------------------------------------------------
# INTERNAL SERVICES (Accessible only from local subnet)
# These should NOT be exposed to the public internet
# ----------------------------------------------------------------------------

print_header "Internal Services (Subnet: $LOCAL_SUBNET)"

# PostgreSQL (port 5432) - Database
# Used for: Direct database access from development machine
# Security: Only allow from local subnet, not public internet
print_step "Allowing PostgreSQL (port 5432) from local subnet..."
ufw allow from $LOCAL_SUBNET to any port 5432 proto tcp comment 'PostgreSQL - Database (subnet only)'
print_success "PostgreSQL allowed from $LOCAL_SUBNET"

# Redis (port 6379) - Cache/Session store
# Used for: Session management, caching
# Security: Only allow from local subnet
print_step "Allowing Redis (port 6379) from local subnet..."
ufw allow from $LOCAL_SUBNET to any port 6379 proto tcp comment 'Redis - Cache (subnet only)'
print_success "Redis allowed from $LOCAL_SUBNET"

# RabbitMQ (port 5672) - Message queue
# Used for: Async task processing (emails, background jobs)
# Security: Only allow from local subnet
print_step "Allowing RabbitMQ (port 5672) from local subnet..."
ufw allow from $LOCAL_SUBNET to any port 5672 proto tcp comment 'RabbitMQ - Message queue (subnet only)'
print_success "RabbitMQ allowed from $LOCAL_SUBNET"

# RabbitMQ Management UI (port 15672)
# Used for: Web-based management console for RabbitMQ
# Security: Only allow from local subnet
print_step "Allowing RabbitMQ Management (port 15672) from local subnet..."
ufw allow from $LOCAL_SUBNET to any port 15672 proto tcp comment 'RabbitMQ Management UI (subnet only)'
print_success "RabbitMQ Management allowed from $LOCAL_SUBNET"

# Kafka (port 9092) - Event streaming
# Used for: Event-driven architecture, pub/sub messaging
# Security: Only allow from local subnet
print_step "Allowing Kafka (port 9092) from local subnet..."
ufw allow from $LOCAL_SUBNET to any port 9092 proto tcp comment 'Kafka - Event streaming (subnet only)'
print_success "Kafka allowed from $LOCAL_SUBNET"

# Kafka Controller (port 9093) - Internal Kafka communication
# Used for: Kafka cluster coordination (KRaft mode)
# Security: Only allow from local subnet
print_step "Allowing Kafka Controller (port 9093) from local subnet..."
ufw allow from $LOCAL_SUBNET to any port 9093 proto tcp comment 'Kafka Controller (subnet only)'
print_success "Kafka Controller allowed from $LOCAL_SUBNET"

# Prometheus (port 9090) - Metrics collection
# Used for: Scraping application metrics
# Security: Only allow from local subnet
print_step "Allowing Prometheus (port 9090) from local subnet..."
ufw allow from $LOCAL_SUBNET to any port 9090 proto tcp comment 'Prometheus - Metrics (subnet only)'
print_success "Prometheus allowed from $LOCAL_SUBNET"

# Rust Application (port 9999) - Backend API (direct access)
# Used for: Direct API access bypassing nginx (development/debugging)
# Security: Only allow from local subnet
print_step "Allowing Rust App (port 9999) from local subnet..."
ufw allow from $LOCAL_SUBNET to any port 9999 proto tcp comment 'Rust App - Direct API (subnet only)'
print_success "Rust App allowed from $LOCAL_SUBNET"

# ----------------------------------------------------------------------------
# DOCKER NETWORK TRAFFIC
# Allow communication between Docker containers
# ----------------------------------------------------------------------------

print_header "Docker Network Traffic"

# Allow all traffic from Docker network
# Used for: Inter-container communication
# Security: Only Docker containers can access this network
print_step "Allowing Docker network traffic ($DOCKER_SUBNET)..."
ufw allow from $DOCKER_SUBNET comment 'Docker internal network'
print_success "Docker network allowed"

# ----------------------------------------------------------------------------
# ENABLE UFW
# ----------------------------------------------------------------------------

print_header "Enabling Firewall"

print_warning "About to enable UFW. Make sure SSH is working!"
echo ""
echo "Current SSH rule status:"
ufw status | grep -E "22|SSH" || echo "  (SSH rule will be applied when enabled)"
echo ""

# Enable UFW (--force skips the confirmation prompt)
print_step "Enabling UFW..."
ufw --force enable
print_success "UFW is now ACTIVE"

# ----------------------------------------------------------------------------
# SHOW FINAL STATUS
# ----------------------------------------------------------------------------

print_header "Firewall Status"

echo ""
ufw status verbose
echo ""

print_header "Setup Complete!"

echo ""
echo "Summary of open ports:"
echo ""
echo "  PUBLIC (anywhere):"
echo "    • 22/tcp   - SSH (remote access)"
echo "    • 80/tcp   - HTTP (nginx)"
echo "    • 443/tcp  - HTTPS (nginx SSL)"
echo "    • 443/udp  - HTTP/3 (QUIC)"
echo "    • 3000/tcp - Grafana (monitoring)"
echo ""
echo "  INTERNAL (subnet $LOCAL_SUBNET only):"
echo "    • 5432/tcp  - PostgreSQL"
echo "    • 5672/tcp  - RabbitMQ"
echo "    • 6379/tcp  - Redis"
echo "    • 9090/tcp  - Prometheus"
echo "    • 9092/tcp  - Kafka"
echo "    • 9093/tcp  - Kafka Controller"
echo "    • 9999/tcp  - Rust App (direct)"
echo "    • 15672/tcp - RabbitMQ Management"
echo ""
echo "  DOCKER ($DOCKER_SUBNET):"
echo "    • All ports - Inter-container communication"
echo ""
print_warning "If you need to modify rules later:"
echo "    • Add rule:    sudo ufw allow <port>/tcp"
echo "    • Remove rule: sudo ufw delete allow <port>/tcp"
echo "    • Check status: sudo ufw status numbered"
echo "    • Disable:     sudo ufw disable"
echo ""
