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

echo "✅ Environment and Authentication look good!"
echo "Note: Accessible Google Drive folders/files depend directly on what you share with your Service Account email."
echo ""
echo "Now, start your AI agent and run this prompt to verify connectivity:"
echo "👉 \"List the most recent file in my Google Drive.\""
