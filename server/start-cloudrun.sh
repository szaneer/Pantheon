#!/bin/sh

# Download Firebase key from Secret Manager if in Cloud Run
if [ -n "$K_SERVICE" ]; then
  echo "Running in Cloud Run, fetching Firebase key..."
  gcloud secrets versions access latest --secret=firebase-key > /app/secrets/firebase-key.json
fi

# Start the Node.js application
exec node server.js