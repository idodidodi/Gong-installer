#!/bin/bash
set -e

USER=$1
USER_PASS=$2
IS_DOCKER=${3:-false}
GONG_BE_BRANCH=$4
GONG_FE_BRANCH=$5
PROJECT_PATH=${6:-~/projects/Gong-be}

# Expand tilde if present
PROJECT_PATH="${PROJECT_PATH/#\~/$HOME}"
BASE_PATH=$(dirname "${PROJECT_PATH}")
TARGET_DIR=$(basename "${PROJECT_PATH}")

# Echo parameters
echo "Parameter 1 (USER): ${USER}"
echo "Parameter 2 (USER_PASS): ${USER_PASS}"
echo "Parameter 3 (IS_DOCKER): ${IS_DOCKER}"
echo "Parameter 4 (GONG_BE_BRANCH): ${GONG_BE_BRANCH}"
echo "Parameter 5 (GONG_FE_BRANCH): ${GONG_FE_BRANCH}"
echo "Project Path: ${PROJECT_PATH}"

# Repository URLs
GONG_BE_REPO="https://github.com/DhammaPamoda/Gong-be.git"
GONG_FE_REPO="https://github.com/DhammaPamoda/Gong_fe.git"

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

# Validate branches before clone
if [ -n "${GONG_BE_BRANCH}" ]; then
  validate_branch "${GONG_BE_REPO}" "${GONG_BE_BRANCH}" || exit 1
fi

if [ -n "${GONG_FE_BRANCH}" ]; then
  validate_branch "${GONG_FE_REPO}" "${GONG_FE_BRANCH}" || exit 1
fi

mkdir -p "${BASE_PATH}"
cd "${BASE_PATH}"

# Call the local deploy.sh script which is in the same directory as this init.sh
SCRIPTS_DIR="$(dirname "$0")"
bash "${SCRIPTS_DIR}/deploy.sh" "${USER}" "${USER_PASS}" "${IS_DOCKER}" "${GONG_BE_BRANCH}" "${GONG_FE_BRANCH}" "${PROJECT_PATH}"
