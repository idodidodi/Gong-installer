#!/bin/bash
# Enhanced cleanup script
# Clears target directory (skipping gong-installer), ~/Gong-be folder, and specific files

USER_PASS=$1
PROJECT_PATH=${2:-~/projects} # Default to ~/projects if not provided

# Expand tilde if present
PROJECT_PATH="${PROJECT_PATH/#\~/$HOME}"

if [ -z "${USER_PASS}" ]; then
  echo "Error: No password provided to extra-clean script."
  exit 1
fi

echo "Target Project Path: ${PROJECT_PATH}"

# Mandatory verification: Must contain gong_server or Gong-be
if [ ! -d "${PROJECT_PATH}/gong_server" ] && [ ! -d "${PROJECT_PATH}/Gong-be" ]; then
  echo "Error: ${PROJECT_PATH} does not appear to be a Gong project (gong_server or Gong-be not found)."
  echo "Aborting to prevent accidental deletion of unrelated data."
  exit 1
fi

# Kill running pm2 processes
echo "Killing all PM2 processes..."
pm2 kill

# Clear target directory (preserving the installer)
if [ -d "${PROJECT_PATH}" ]; then
  echo "Clearing items in ${PROJECT_PATH} (skipping gong-installer)..."
  find "${PROJECT_PATH}" -maxdepth 1 ! -name "gong-installer" ! -path "${PROJECT_PATH}" -print0 | xargs -0 -I {} echo "${USER_PASS}" | sudo -S rm -rv {} 2>/dev/null || true
  echo "${PROJECT_PATH} cleanup completed!"
else
  echo "${PROJECT_PATH} directory does not exist. Nothing to clean."
fi

# Clear ~/Gong-be folder
if [ -d ~/Gong-be ]; then
  echo "Clearing ~/Gong-be folder..."
  echo "${USER_PASS}" | sudo -S rm -rv ~/Gong-be
  echo "~/Gong-be cleanup completed!"
fi

# Delete specific files from home directory
echo "Checking for specific files in home directory..."

FILES_TO_DELETE=(
  "deploy_gong.sh"
  "deploy_gong_actions.sh"
  "docker_init.sh"
)

for file in "${FILES_TO_DELETE[@]}"; do
  if [ -f ~/"$file" ]; then
    echo "Deleting ~/$file..."
    rm -fv ~/"$file"
  else
    echo "~/$file does not exist. Skipping."
  fi
done

echo "All cleanup operations completed!"



