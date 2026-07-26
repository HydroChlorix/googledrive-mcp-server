#!/bin/bash
# scripts/verify-setup.sh
# Verifies the Keyless Auth (ADC) setup for Google Drive MCP

echo "🔍 Checking Google Drive MCP Keyless Setup..."

# 1. Check gcloud CLI
if ! command -v gcloud &> /dev/null; then
    echo "❌ Error: gcloud CLI is not installed. This is a HARD PREREQUISITE."
    exit 1
fi

# 2. Check ADC / Impersonation
echo "🔍 Checking Application Default Credentials..."
if ! gcloud auth application-default print-access-token &> /dev/null; then
    echo "❌ Error: Application Default Credentials (ADC) are not configured."
    echo "Please run: gcloud auth application-default login --impersonate-service-account=\"YOUR_SA_EMAIL\""
    exit 1
fi

# 3. Check for JSON keys (Violation of Policy)
if [ -n "$GOOGLE_APPLICATION_CREDENTIALS" ]; then
    echo "⚠️ Warning: GOOGLE_APPLICATION_CREDENTIALS is set to: $GOOGLE_APPLICATION_CREDENTIALS"
    echo "Checking if it is a JSON Key..."
    if grep -q "private_key" "$GOOGLE_APPLICATION_CREDENTIALS" 2>/dev/null; then
        echo "❌ CRITICAL SECURITY VIOLATION: JSON Key detected in GOOGLE_APPLICATION_CREDENTIALS."
        echo "Delete the key file and unset the variable to comply with Zero Key Policy."
        exit 1
    fi
fi

echo "✅ Environment and Authentication look good!"
echo "Note: Accessible Google Drive folders/files depend directly on what you share with your Service Account email."
echo ""
echo "Now, start your AI agent and run this prompt to verify connectivity:"
echo "👉 \"List the most recent file in my Google Drive.\""
