#!/bin/bash
# scripts/verify-setup.sh

echo "Checking MCP Server Configuration..."

if [ ! -f .env.googledrive ]; then
    echo "❌ Error: .env.googledrive file not found."
    exit 1
fi

source .env.googledrive

if [ -z "$GOOGLE_SERVICE_ACCOUNT_KEY" ]; then
    echo "❌ Error: GOOGLE_SERVICE_ACCOUNT_KEY is not set."
    exit 1
fi

if [ ! -f "$GOOGLE_SERVICE_ACCOUNT_KEY" ]; then
    echo "❌ Error: Service Account Key file not found at $GOOGLE_SERVICE_ACCOUNT_KEY"
    exit 1
fi

if [ -z "$GOOGLE_DRIVE_ROOT_FOLDER_ID" ]; then
    echo "❌ Error: GOOGLE_DRIVE_ROOT_FOLDER_ID is not set."
    exit 1
fi

echo "✅ Configuration looks good!"
echo ""
echo "Now, start your AI agent and run this prompt to verify connectivity:"
echo "👉 \"List the most recent file in my Google Drive.\""
