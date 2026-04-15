#!/bin/bash
set -e

ENV_FILE=".env.local"

echo "Setting up local development environment..."

# Check supabase CLI
if ! command -v supabase &>/dev/null; then
  echo "Installing Supabase CLI..."
  brew install supabase/tap/supabase
fi

# Fix Docker socket path on Mac (Docker Desktop uses non-standard socket)
export DOCKER_HOST=unix://$HOME/.docker/run/docker.sock

# Init supabase if not already done
if [ ! -f "supabase/config.toml" ]; then
  supabase init
fi

# Start local Supabase
echo "Starting local Supabase..."
SUPABASE_OUTPUT=$(supabase start 2>&1)
echo "$SUPABASE_OUTPUT"

# Extract keys from output
API_URL=$(echo "$SUPABASE_OUTPUT" | grep "API URL" | awk '{print $NF}')
ANON_KEY=$(echo "$SUPABASE_OUTPUT" | grep "anon key" | awk '{print $NF}')
SERVICE_KEY=$(echo "$SUPABASE_OUTPUT" | grep "service_role key" | awk '{print $NF}')

# Fallback: get keys from supabase status if start output is different
if [ -z "$ANON_KEY" ]; then
  STATUS=$(supabase status 2>/dev/null)
  API_URL=$(echo "$STATUS" | grep "API URL" | awk '{print $NF}')
  ANON_KEY=$(echo "$STATUS" | grep "anon key" | awk '{print $NF}')
  SERVICE_KEY=$(echo "$STATUS" | grep "service_role key" | awk '{print $NF}')
fi

if [ -z "$ANON_KEY" ]; then
  echo "Could not extract Supabase keys. Run 'supabase status' manually."
  exit 1
fi

# Write .env.local
cat > "$ENV_FILE" <<EOF
# App
NEXT_PUBLIC_APP_NAME=MVP
NEXT_PUBLIC_APP_DOMAIN=localhost:3000

# Supabase (local)
NEXT_PUBLIC_SUPABASE_URL=${API_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SERVICE_KEY}

# AI (add your key)
OPENROUTER_API_KEY=

# Feature Agent — GitHub
GITHUB_TOKEN=
GITHUB_OWNER=
GITHUB_REPO=

# Feature Agent — Vercel
VERCEL_TOKEN=
VERCEL_PROJECT_ID=
VERCEL_TEAM_ID=
EOF

echo ""
echo "✓ .env.local written"
echo "  URL:  $API_URL"
echo "  Anon: ${ANON_KEY:0:20}..."
echo ""
echo "Next: add OPENROUTER_API_KEY to .env.local, then run: npm run dev"
echo "Open: http://localhost:3000/setup"
