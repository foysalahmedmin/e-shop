#!/bin/bash

# Update system
yum update -y

# Install Docker
yum install -y docker
systemctl start docker
systemctl enable docker
usermod -a -G docker ec2-user

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Install Git
yum install -y git

# Install jq for JSON parsing
yum install -y jq

# Install curl for health checks
yum install -y curl

# Create application directory
mkdir -p /home/ec2-user/eshop
chown ec2-user:ec2-user /home/ec2-user/eshop

# Install Node.js (for npm scripts)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | sudo -u ec2-user bash
sudo -u ec2-user bash -c 'source ~/.bashrc && nvm install 18 && nvm use 18'

echo "EC2 instance setup completed!"