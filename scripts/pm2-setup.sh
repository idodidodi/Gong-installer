#!/bin/bash
set -e

USER_PASS=$1
ECOSYSTEM_PATH=$2

if [ -z "$USER_PASS" ]; then
    echo "Error: Password not provided."
    exit 1
fi

if [ -z "$ECOSYSTEM_PATH" ]; then
    echo "Error: Ecosystem path not provided."
    exit 1
fi

# Expand tilde if present
ECOSYSTEM_PATH="${ECOSYSTEM_PATH/#\~/$HOME}"

echo "Starting ecosystem with input group permissions..."
# Use sg input to ensure the PM2 processes start with the 'input' group permissions
# necessary for hk4_listener to access /dev/input devices.
# Use startOrRestart so this is safe to run even if processes are already registered in PM2.
sg input -c "pm2 startOrRestart \"$ECOSYSTEM_PATH\""

echo "Generating startup command..."
# Run pm2 startup and capture the output. 
# We need to find the line that starts with 'sudo'
STARTUP_OUTPUT=$(pm2 startup systemd | grep "sudo env PATH")

if [ -z "$STARTUP_OUTPUT" ]; then
    echo "Warning: No sudo startup command found in output. It might already be configured or require manual intervention."
    # We continue to save regardless
else
    echo "Executing startup command automatically..."
    # Execute the command by piping the password to sudo -S
    eval "sudo -S $STARTUP_OUTPUT <<< \"$USER_PASS\""
fi

echo "Saving PM2 list..."
pm2 save

echo "PM2 Setup Complete."
pm2 list
