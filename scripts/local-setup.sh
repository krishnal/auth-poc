#!/bin/bash

set -e

echo "Setting up local development environment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo "Please update .env with your AWS and Google OAuth credentials"
    echo "Opening .env file for editing..."
    ${EDITOR:-nano} .env
fi

echo "Installing dependencies..."
make install

echo "Building and starting services..."
docker-compose up --build -d

echo "Waiting for services to be ready..."
sleep 10

echo "Checking service health..."
curl -f http://localhost:3001/health || echo "Backend health check failed"
curl -f http://localhost:3000 || echo "Frontend health check failed"

echo "Local development environment is ready!"
echo "Frontend: http://localhost:3000"
echo "Backend: http://localhost:3001"
echo ""
echo "To view logs: make dev-logs"
echo "To stop services: make dev-stop"