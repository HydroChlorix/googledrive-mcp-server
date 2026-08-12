#!/bin/bash
# scripts/verify-setup.sh
# Verifies Auth (ADC/Service Account Key), Environment Boundaries, and Log Directory for Google Drive MCP Server

echo "🔍 Checking Google Drive MCP Server Environment & Authentication Setup..."

# 1. Authentication Check (SA Key File or ADC)
if [ -n "$GOOGLE_APPLICATION_CREDENTIALS" ]; then
    echo "🔍 Checking Service Account JSON Key (GOOGLE_APPLICATION_CREDENTIALS)..."
    if [ -f "$GOOGLE_APPLICATION_CREDENTIALS" ]; then
        echo "✅ Service Account Key file found: $GOOGLE_APPLICATION_CREDENTIALS"
    else
        echo "❌ Error: GOOGLE_APPLICATION_CREDENTIALS is set to '$GOOGLE_APPLICATION_CREDENTIALS' but file does not exist!"
        exit 1
    fi
else
    echo "🔍 Checking Application Default Credentials (ADC via gcloud)..."
    if ! command -v gcloud &> /dev/null; then
        echo "❌ Error: gcloud CLI is not installed and GOOGLE_APPLICATION_CREDENTIALS is not set."
        echo "   Please install gcloud CLI or set GOOGLE_APPLICATION_CREDENTIALS to a Service Account JSON Key file."
        exit 1
    fi

    ADC_ERROR=$(gcloud auth application-default print-access-token 2>&1 >/dev/null)
    if [ $? -ne 0 ]; then
        echo "❌ Error: Application Default Credentials (ADC) are not configured correctly."
        
        if echo "$ADC_ERROR" | grep -q -i "Gaia id not found"; then
            echo ""
            echo "🚨 ERROR: You used a personal/company email instead of a Service Account!"
            echo "   The --impersonate-service-account flag requires a Google Cloud Service Account."
            echo "   (It usually ends with @<project-id>.iam.gserviceaccount.com)"
            echo "   DO NOT use your personal @gmail.com or @company.com address!"
        fi

        echo ""
        echo "Please run: gcloud auth application-default login --impersonate-service-account=\"YOUR_SERVICE_ACCOUNT_EMAIL\""
        exit 1
    fi
    echo "✅ Application Default Credentials (ADC) verified."
fi

# 2. Check Mandatory Shared Drive Boundary Configuration
echo "🔍 Checking Boundary Configuration..."
SHARED_DRIVE_ID="${GOOGLE_DRIVE_SHARED_DRIVE_ID}"

# Check .env file if environment variable is not directly set in current shell
if [ -z "$SHARED_DRIVE_ID" ] && [ -f ".env" ]; then
    SHARED_DRIVE_ID=$(grep -E "^GOOGLE_DRIVE_SHARED_DRIVE_ID=" .env | cut -d '=' -f2 | tr -d '"' | tr -d "'")
fi

if [ -n "$SHARED_DRIVE_ID" ]; then
    echo "✅ GOOGLE_DRIVE_SHARED_DRIVE_ID is configured: $SHARED_DRIVE_ID"
else
    echo "⚠️ Warning: GOOGLE_DRIVE_SHARED_DRIVE_ID is NOT set in environment or .env file."
    echo "   The server requires GOOGLE_DRIVE_SHARED_DRIVE_ID to start."
    echo "   Ensure it is set in your MCP client config (e.g. claude_desktop_config.json) or .env."
fi

# 3. Check Operation Log Directory & Writability
echo "🔍 Checking Operation Logger directory..."
LOG_DIR="$HOME/.mcp/logs"
mkdir -p "$LOG_DIR" 2>/dev/null
if [ -w "$LOG_DIR" ]; then
    echo "✅ Operation Logger directory ($LOG_DIR) is ready and writable."
else
    echo "❌ Error: Operation Logger directory ($LOG_DIR) is not writable."
    exit 1
fi

echo ""
echo "✅ Environment and Authentication pre-flight verification complete!"
echo "Now, start your AI agent and run this prompt to verify connectivity:"
echo "👉 \"List the most recent file in my Google Drive.\""
