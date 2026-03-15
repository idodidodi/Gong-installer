#!/bin/bash
DEV_PATH="$1"

# Identify source FTDI directory
if [ -d "$HOME/gong/gong_server/node_modules/ftdi-d2xx" ]; then
    SOURCE_DIR="$HOME/gong/gong_server/node_modules/ftdi-d2xx"
    MOD_NAME="ftdi-d2xx"
else
    echo "Source ftdi-d2xx directory not found in $HOME/gong/gong_server/node_modules/"
    exit 1
fi

echo "Using DEV Path: $DEV_PATH"
echo "Source ftdi-d2xx dir: $SOURCE_DIR"

DEST_BE_ROOT="$DEV_PATH/Gong-be"
DEST_SERVER_ROOT="$DEV_PATH/gong_server"

# Validation Phase
if [ ! -d "$DEST_BE_ROOT" ]; then
    echo "Validation failed: Could not find Gong-be inside DEV path ($DEST_BE_ROOT)"
    # Don't exit 1 yet if they just want to copy to the other one, but realistically we want both or none. Let's just warn or skip.
    echo "Skipping Gong-be..."
    SKIP_BE=1
fi

if [ ! -d "$DEST_SERVER_ROOT" ]; then
    echo "Validation failed: Could not find gong_server inside DEV path ($DEST_SERVER_ROOT)"
    echo "Skipping gong_server..."
    SKIP_SERVER=1
fi

if [ "$SKIP_BE" == "1" ] && [ "$SKIP_SERVER" == "1" ]; then
    echo "Both destination projects are missing from $DEV_PATH. Aborting copy."
    exit 1
fi

DEST_BE="$DEST_BE_ROOT/node_modules/$MOD_NAME"
DEST_SERVER="$DEST_SERVER_ROOT/node_modules/$MOD_NAME"

# Execution Phase
if [ "$SKIP_BE" != "1" ]; then
    if [ "$SOURCE_DIR" != "$DEST_BE" ]; then
        echo "Copying to Gong-be..."
        if [ -d "$DEST_BE" ]; then
            echo "Overriding existing $MOD_NAME in Gong-be..."
            rm -rf "$DEST_BE"
        fi
        mkdir -p "$DEST_BE_ROOT/node_modules"
        cp -r "$SOURCE_DIR" "$DEST_BE"
    else
        echo "Source and destination for Gong-be are the same ($SOURCE_DIR), skipping."
    fi
fi

if [ "$SKIP_SERVER" != "1" ]; then
    if [ "$SOURCE_DIR" != "$DEST_SERVER" ]; then
        echo "Copying to gong_server..."
        if [ -d "$DEST_SERVER" ]; then
            echo "Overriding existing $MOD_NAME in gong_server..."
            rm -rf "$DEST_SERVER"
        fi
        mkdir -p "$DEST_SERVER_ROOT/node_modules"
        cp -r "$SOURCE_DIR" "$DEST_SERVER"
    else
        echo "Source and destination for gong_server are the same ($SOURCE_DIR), skipping."
    fi
fi

echo "FTDI copy completed successfully!"
