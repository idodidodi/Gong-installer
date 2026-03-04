#!/bin/bash

# Navigate to project directory
cd "$(dirname "$0")"

# Start the server in the background
chmod +x scripts/*.sh
node server.js &
SERVER_PID=$!

# Wait for server to start
sleep 2

# Detect browser and launch UI
URL="http://localhost:3005"

if command -v google-chrome &> /dev/null; then
    google-chrome --app="$URL" --user-data-dir="/tmp/gong-installer-profile"
elif command -v chromium-browser &> /dev/null; then
    chromium-browser --app="$URL" --user-data-dir="/tmp/gong-installer-profile"
elif command -v xdg-open &> /dev/null; then
    xdg-open "$URL"
else
    echo "Please open $URL in your browser"
fi

# Kill the server when the browser/shell script exits
kill $SERVER_PID
