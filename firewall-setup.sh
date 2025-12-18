#!/bin/bash
set -e

echo "=========================================="
echo "Firewall Setup Script"
echo "=========================================="

# Try to configure firewall - will only work in privileged mode
# If not privileged, commands will fail silently and app continues

configure_iptables() {
    echo "Configuring iptables..."
    
    # Flush existing rules (be careful with this)
    iptables -F INPUT 2>/dev/null || true
    
    # Allow loopback
    iptables -A INPUT -i lo -j ACCEPT 2>/dev/null || true
    
    # Allow established connections
    iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT 2>/dev/null || true
    
    # Allow SSH
    iptables -A INPUT -p tcp --dport 22 -j ACCEPT 2>/dev/null || true
    
    # Allow app port (nginx external)
    iptables -A INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || true
    iptables -A INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || true
    
    # Allow internal app port
    iptables -A INPUT -p tcp --dport 8888 -j ACCEPT 2>/dev/null || true
    
    # Allow PostgreSQL from local 5432
    iptables -A INPUT -p tcp -s 192.168.0.0/24 --dport 5432 -j ACCEPT 2>/dev/null || true
    iptables -A INPUT -p tcp -s 172.28.0.0/16 --dport 5432 -j ACCEPT 2>/dev/null || true
    
    echo "iptables configured (or skipped if not privileged)"
}

configure_ufw() {
    echo "Configuring UFW..."
    
    # Check if ufw is available and we have permissions
    if command -v ufw &> /dev/null; then
        ufw allow 22/tcp 2>/dev/null || true
        ufw allow 80/tcp 2>/dev/null || true
        ufw allow 443/tcp 2>/dev/null || true
        ufw allow 8888/tcp 2>/dev/null || true
        ufw allow from 192.168.0.0/24 to any port 5432 proto tcp 2>/dev/null || true
        ufw --force enable 2>/dev/null || true
        echo "UFW configured (or skipped if not privileged)"
    fi
}

# Try both methods - they'll fail silently if not privileged
configure_iptables
configure_ufw

echo "Firewall setup complete (or skipped)"
echo "=========================================="
echo ""