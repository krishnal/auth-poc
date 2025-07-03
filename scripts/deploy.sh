#!/bin/bash

set -e

STAGE=${1:-dev}
echo "Deploying to $STAGE environment..."

# Check if required environment variables are set
if [ -z "$GOOGLE_CLIENT_ID" ] || [ -z "$GOOGLE_CLIENT_SECRET" ]; then
    echo "Error: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set"
    exit 1
fi

echo "Building infrastructure..."
cd infrastructure
npm run build

echo "Deploying CDK stack..."
npm run cdk deploy -- \
    --context stage=$STAGE \
    --context googleClientId=$GOOGLE_CLIENT_ID \
    --context googleClientSecret=$GOOGLE_CLIENT_SECRET \
    --require-approval never

echo "Deployment complete!"