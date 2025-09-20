#!/bin/bash

# HearTalk AI MVP Development Environment Setup Script

echo "🚀 Setting up HearTalk AI MVP Development Environment..."

# Check Node.js version
echo "📋 Checking Node.js version..."
node_version=$(node -v)
required_version="v18"

if [[ $node_version < $required_version ]]; then
    echo "❌ Node.js version $node_version is not supported. Please upgrade to $required_version or higher."
    exit 1
else
    echo "✅ Node.js version: $node_version"
fi

# Check npm version
echo "📋 Checking npm version..."
npm_version=$(npm -v)
echo "✅ npm version: $npm_version"

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p logs
mkdir -p config
echo "✅ Directories created"

# Check environment file
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Copying from .env.example..."
    cp .env.example .env
    echo "🔧 Please update .env file with your actual configuration values"
else
    echo "✅ .env file exists"
fi

# Run linting
echo "🔍 Running linting..."
npm run lint

# Run tests
echo "🧪 Running tests..."
npm test

# Check if everything is working
echo "🏥 Testing server health..."
npm start &
server_pid=$!
sleep 3

# Test health endpoint
health_response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8001/api/v1/health)
if [ "$health_response" = "200" ]; then
    echo "✅ Server is healthy!"
else
    echo "❌ Server health check failed (HTTP $health_response)"
fi

# Kill the test server
kill $server_pid 2>/dev/null

echo ""
echo "🎉 Development environment setup complete!"
echo ""
echo "📝 Next steps:"
echo "  1. Update .env file with your actual configuration"
echo "  2. Run 'npm run dev' to start development server"
echo "  3. Visit http://localhost:8001 to verify the service"
echo "  4. Visit http://localhost:8001/api/v1/health for health check"
echo ""
echo "🛠️  Available commands:"
echo "  npm start      - Start production server"
echo "  npm run dev    - Start development server with hot reload"
echo "  npm test       - Run tests"
echo "  npm run lint   - Run ESLint"
echo "  npm run lint:fix - Fix ESLint issues automatically"
echo ""