#!/bin/bash
# set -x removed for security reasons to prevent password leakage in logs
set -e

USER=$1
USER_PASS=$2
IS_DOCKER=${3:-false}
GONG_BE_BRANCH=$4
GONG_FE_BRANCH=$5
BASE_DIR=$6

GONG_DEV_OPS_DIR="${BASE_DIR}/gong_dev_ops"
DEV_OPS_FILES_DIR="${GONG_DEV_OPS_DIR}/dev_ops"

set -v
cd "${BASE_DIR}/"

export HISTIGNORE='*sudo -S*'

# Function to validate branch exists on remote
validate_branch() {
  local repo_url=$1
  local branch_name=$2
  
  if [ -z "$branch_name" ]; then
    return 0  # Empty branch name means use default
  fi
  
  if git ls-remote --heads "$repo_url" "$branch_name" | grep -q "refs/heads/$branch_name"; then
    return 0  # Branch exists
  else
    echo "Error: Branch '$branch_name' does not exist on remote repository $repo_url"
    return 1  # Branch does not exist
  fi
}

# Getting the FE and BE
GONG_BE_REPO="https://github.com/DhammaPamoda/Gong-be.git"
GONG_FE_REPO="https://github.com/DhammaPamoda/Gong_fe.git"

# Clean up existing directories before cloning
if [ -d "${BASE_DIR}/Gong-be" ]; then
  echo "Removing existing Gong-be directory..."
  rm -rf "${BASE_DIR}/Gong-be"
fi

if [ -d "${BASE_DIR}/Gong_fe" ]; then
  echo "Removing existing Gong_fe directory..."
  rm -rf "${BASE_DIR}/Gong_fe"
fi

if [ -n "${GONG_BE_BRANCH}" ]; then
  validate_branch "${GONG_BE_REPO}" "${GONG_BE_BRANCH}" || exit 1
  git clone -b "${GONG_BE_BRANCH}" "${GONG_BE_REPO}"
else
  git clone "${GONG_BE_REPO}"
fi

if [ -n "${GONG_FE_BRANCH}" ]; then
  validate_branch "${GONG_FE_REPO}" "${GONG_FE_BRANCH}" || exit 1
  git clone -b "${GONG_FE_BRANCH}" "${GONG_FE_REPO}"
else
  git clone "${GONG_FE_REPO}"
fi

# ==========================================
# Dynamic Path Patching
# ==========================================
# Patching scripts in Gong-be/dev_ops to use the selected BASE_DIR
echo "Patching scripts for dynamic path resolution..."
# Escape BASE_DIR for sed
ESCAPED_BASE_DIR=$(echo "${BASE_DIR}" | sed 's/\//\\\//g')
find "${BASE_DIR}/Gong-be/dev_ops" -type f \( -name "*.sh" -o -name "*.js" -o -name "*.service" -o -name "*.txt" \) -exec sed -i "s/\/home\/${USER}\/projects/${ESCAPED_BASE_DIR}/g" {} +
# Also patch 'dhamma' user occurrences if they exist as hardcoded fallbacks
find "${BASE_DIR}/Gong-be/dev_ops" -type f \( -name "*.sh" -o -name "*.js" -o -name "*.service" -o -name "*.txt" \) -exec sed -i "s/\/home\/dhamma\/projects/${ESCAPED_BASE_DIR}/g" {} +

# Populating the dev_ops
cp -rf "${BASE_DIR}/Gong-be/dev_ops" "${GONG_DEV_OPS_DIR}/"
cp -f "${DEV_OPS_FILES_DIR}/refresh_dev_ops.sh" "${GONG_DEV_OPS_DIR}/"
cp -f "${DEV_OPS_FILES_DIR}/refresh_gong_server.sh" "${GONG_DEV_OPS_DIR}/"

# XDG Data Directory Setup
echo "Setting up Gong data directory..."
XDG_DATA_HOME="${XDG_DATA_HOME:-/home/${USER}/.local/share}"
GONG_DATA_DIR="${XDG_DATA_HOME}/gong"
mkdir -p "${GONG_DATA_DIR}"

# HW Support
echo "Configuring hardware access for USB HK4 Keyboard..."
sudo -S usermod -a -G input "${USER}" <<< "${USER_PASS}"

# Building the BE and FE
"${DEV_OPS_FILES_DIR}"/refresh_gong_server_be.sh "${USER}" "${USER_PASS}" "${GONG_BE_BRANCH}"
"${DEV_OPS_FILES_DIR}"/refresh_gong_server_fe.sh "${USER}" "${USER_PASS}" "${GONG_FE_BRANCH}"

# logrotate
sudo -S cp -f "${DEV_OPS_FILES_DIR}/gong_logrotate" /etc/logrotate.d/gong <<< "${USER_PASS}"
sudo -S sed -i "s/dhamma/${USER}/g" /etc/logrotate.d/gong <<< "${USER_PASS}"

# pm2 shell to start the app
"${DEV_OPS_FILES_DIR}"/create_pm2_gong_server_process.sh "${USER}" "${USER_PASS}" "${IS_DOCKER}"
