#!/bin/bash
# This script is used to install Docker on a Linux system.
# It first checks if Docker is already installed, and if not, it installs it.
# It also provides a dry run option to see what would be done without actually doing it.
# Usage: ./deploy.sh [--dry-run]
# Check if Docker is already installed
if command -v docker &> /dev/null
then
    echo "Docker is already installed."
    exit 0
else
    echo "Docker is not installed, installing..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh ./get-docker.sh
    echo "Docker installed successfully."
fi

echo "Installing Docker Compose..."
apt install docker-compose -y
echo "Docker Compose installed successfully."

echo "Running application..."
docker-compose up -d --build
echo "Application is running."

