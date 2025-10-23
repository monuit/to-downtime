#!/bin/bash
# Quick setup script for Toronto Downtime

echo "🚇 Setting up Toronto Downtime..."

# Check if bun or npm is available
if command -v bun &> /dev/null; then
    echo "✓ Using Bun"
    bun install
    echo "✓ Dependencies installed"
    echo ""
    echo "🚀 Starting dev server..."
    bun run dev
elif command -v npm &> /dev/null; then
    echo "✓ Using npm"
    npm install
    echo "✓ Dependencies installed"
    echo ""
    echo "🚀 Starting dev server..."
    npm run dev
else
    echo "❌ Neither bun nor npm found. Please install Node.js or Bun."
    exit 1
fi
