#!/bin/bash

if [ ! -f ".env" ]; then
  echo "Error: .env file not found. Please create one."
  exit 1
fi

if [ ! -f "cookies.json" ]; then
  echo "Error: cookies.json file not found. Please create one."
  exit 1
fi

if command -v docker &> /dev/null
then
  echo "Docker is already installed."
else
  echo "Docker is not installed, installing..."
  curl -fsSL https://get.docker.com -o get-docker.sh
  sudo sh ./get-docker.sh
  echo "Docker installed successfully."
fi

if command -v docker-compose &> /dev/null
then
  echo "Docker Compose is already installed."
else
  echo "Docker Compose is not installed, installing..."
  curl -SL https://github.com/docker/compose/releases/download/v2.35.0/docker-compose-linux-x86_64 -o /usr/local/bin/docker-compose
  chmod +x /usr/local/bin/docker-compose
  echo "Docker Compose installed successfully."
fi

source ~/.bashrc

echo "Down Application"
docker-compose down --remove-orphans

echo "Running application..."
docker-compose up -d --build
echo "Running application completed."

echo "Clean unused docker container and image..."
docker system prune -f
echo "Clean unused docker container and image completed."

echo "🎉 Application deployed successfully!"
