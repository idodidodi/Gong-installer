#!/bin/bash
# Cleanup script derived from deploy_gong_actions.sh
# Clears contents of target directory (skipping gong-installer)

USER_PASS=$1
PROJECT_PATH=${2:-~/projects} # Default to ~/projects if not provided

# Expand tilde if present
PROJECT_PATH="${PROJECT_PATH/#\~/$HOME}"

if [ -z "${USER_PASS}" ]; then
  echo "Error: No password provided to cleanup script."
  exit 1
fi

echo "Target Project Path: ${PROJECT_PATH}"

# Mandatory verification: Must contain gong_server or Gong-be
if [ ! -d "${PROJECT_PATH}/gong_server" ] && [ ! -d "${PROJECT_PATH}/Gong-be" ]; then
  echo "Error: ${PROJECT_PATH} does not appear to be a Gong project (gong_server or Gong-be not found)."
  echo "Aborting to prevent accidental deletion of unrelated data."
  exit 1
fi

if [ -d "${PROJECT_PATH}" ]; then
  echo "Clearing items in ${PROJECT_PATH} (skipping gong-installer)..."
  # Find all items in PROJECT_PATH, excluding the directory itself and gong-installer
  # Then remove them with verbose output
  find "${PROJECT_PATH}" -maxdepth 1 ! -name "gong-installer" ! -path "${PROJECT_PATH}" -print0 | xargs -0 -I {} echo "${USER_PASS}" | sudo -S rm -rv {} 2>/dev/null || true
  echo "Cleanup of ${PROJECT_PATH} completed!"
else
  echo "${PROJECT_PATH} directory does not exist. Nothing to clean."
fi

if [ -d ~/Gong-be ]; then
  echo "Clearing ~/Gong-be folder..."
  echo "${USER_PASS}" | sudo -S rm -rv ~/Gong-be
  echo "Cleanup of ~/Gong-be completed!"
fi

