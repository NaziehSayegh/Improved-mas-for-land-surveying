#!/bin/bash

echo "========================================"
echo "   PARCEL TOOLS - Installation"
echo "========================================"
echo ""

echo "[1/3] Installing Node.js dependencies..."
npm install

echo ""
echo "[2/3] Installing Python dependencies..."
cd backend
pip3 install -r requirements.txt
cd ..

echo ""
echo "[3/3] Setup complete!"
echo ""
echo "========================================"
echo "Installation finished successfully!"
echo ""
echo "To start the app, run: ./start.sh"
echo "Or use: npm run electron:dev"
echo "========================================"



