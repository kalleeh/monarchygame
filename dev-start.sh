#!/bin/bash

echo "🚀 Starting Monarchy Game Development Environment..."

# Kill existing processes
pkill -f "vite"
pkill -f "ampx"

# Start Amplify sandbox in background
echo "📡 Starting Amplify sandbox..."
npx ampx sandbox &
AMPLIFY_PID=$!

# Wait for Amplify to be ready
sleep 5

# Start frontend in background
echo "🎮 Starting frontend development server..."
cd frontend && npm run dev &
FRONTEND_PID=$!

# Wait for frontend to be ready
sleep 3

echo "✅ Development environment ready!"
echo "🌐 Frontend: http://localhost:5173"
echo "📡 Amplify sandbox running (PID: $AMPLIFY_PID)"
echo "🎮 Frontend server running (PID: $FRONTEND_PID)"
echo ""
echo "To stop all services, run: pkill -f 'vite|ampx'"

# Keep script running
wait
