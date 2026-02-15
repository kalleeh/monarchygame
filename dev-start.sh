#!/bin/bash

set -e

echo "🚀 Starting Monarchy Game Development Environment..."

# Function to cleanup on exit
cleanup() {
    echo "🧹 Cleaning up..."
    pkill -f "vite" 2>/dev/null || true
    pkill -f "ampx" 2>/dev/null || true
    exit 0
}

trap cleanup SIGINT SIGTERM

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm is required"; exit 1; }

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing root dependencies..."
    npm install
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd frontend && npm install && cd ..
fi

# Kill existing processes
pkill -f "vite" 2>/dev/null || true
pkill -f "ampx" 2>/dev/null || true

# Start Amplify sandbox
echo "📡 Starting Amplify sandbox..."
npx ampx sandbox &
AMPLIFY_PID=$!

# Wait for Amplify to be ready
echo "⏳ Waiting for Amplify sandbox..."
sleep 8

# Start frontend
echo "🎮 Starting frontend development server..."
cd frontend && npm run dev &
FRONTEND_PID=$!

# Wait for frontend to be ready
echo "⏳ Waiting for frontend server..."
sleep 5

echo "✅ Development environment ready!"
echo "🌐 Frontend: http://localhost:5173"
echo "📡 Amplify sandbox running (PID: $AMPLIFY_PID)"
echo "🎮 Frontend server running (PID: $FRONTEND_PID)"
echo ""
echo "Press Ctrl+C to stop all services"

# Keep script running
wait
