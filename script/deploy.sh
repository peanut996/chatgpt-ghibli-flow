#!/bin/bash
# This script is used to install Docker on a Linux system.
# It first checks if Docker is already installed, and if not, it installs it.
# It also provides a dry run option to see what would be done without actually doing it.
# Usage: ./deploy.sh [--dry-run]

# Check for .env and cookies.json files
if [ ! -f ".env" ]; then
  echo "Error: .env file not found. Please create one."
  exit 1
fi

if [ ! -f "cookies.json" ]; then
  echo "Error: cookies.json file not found. Please create one."
  exit 1
fi

# Check if Docker is already installed
if command -v docker &> /dev/null
then
  echo "Docker is already installed."
else
  echo "Docker is not installed, installing..."
  curl -fsSL https://get.docker.com -o get-docker.sh
  sudo sh ./get-docker.sh
  echo "Docker installed successfully."
fi

# Check if Docker Compose is already installed
if command -v docker-compose &> /dev/null
then
  echo "Docker Compose is already installed."
else
  echo "Docker Compose is not installed, installing..."
  apt install docker-compose -y
  echo "Docker Compose installed successfully."
fi

echo "Running application..."
docker-compose up -d --build
echo "Application is running."
