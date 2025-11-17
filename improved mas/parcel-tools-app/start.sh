#!/bin/bash

echo "========================================"
echo "   PARCEL TOOLS - Desktop App"
echo "   Starting Application..."
echo "========================================"
echo ""

echo "[1/2] Starting Python Backend..."
python3 backend/app.py &
BACKEND_PID=$!

sleep 3

echo "[2/2] Starting Electron App..."
npm run electron:dev

echo ""
echo "Application started successfully!"

# Kill backend when done
kill $BACKEND_PID



