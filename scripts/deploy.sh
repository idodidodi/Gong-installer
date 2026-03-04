#!/bin/bash
# set -e used to stop on error, but set -x removed for security (avoid password leaks in logs)
set -e

USER=$1
USER_PASS=$2
IS_DOCKER=${3:-false}
GONG_BE_BRANCH=$4
GONG_FE_BRANCH=$5
BASE_DIR=$6

# Essential dirs
# Use the provided BASE_DIR instead of hardcoded projects folder
mkdir -p "${BASE_DIR}"
GONG_DEV_OPS_DIR="${BASE_DIR}/gong_dev_ops"
mkdir -p "${GONG_DEV_OPS_DIR}"
mkdir -p "${GONG_DEV_OPS_DIR}/dev_ops_logs"
mkdir -p "${BASE_DIR}/gong_server"

log_file=${GONG_DEV_OPS_DIR}/dev_ops_logs/0_initial_deployment_$(date +"%Y_%m_%d_%H_%M_%S").log

# Call deploy_actions.sh (local script in the same directory)
SCRIPTS_DIR="$(dirname "$0")"
"${SCRIPTS_DIR}/deploy_actions.sh" "${USER}" "${USER_PASS}" "${IS_DOCKER}" "${GONG_BE_BRANCH}" "${GONG_FE_BRANCH}" "${BASE_DIR}" 2>&1 | tee -a "${log_file}"
