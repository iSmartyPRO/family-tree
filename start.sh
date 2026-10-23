#!/bin/sh

# PID 1 starts as root only for nginx (port 80, master process); its workers and
# the Node app run unprivileged. The app writes two places: uploads and the .env
# the setup wizard fills — hand them to the `node` user (uid 1000) before start.
APP_USER=node
mkdir -p /app/uploads
find /app/uploads ! -user "$APP_USER" -exec chown "$APP_USER:$APP_USER" {} + 2>/dev/null || true
if [ -f /app/.env ]; then
    chown "$APP_USER:$APP_USER" /app/.env 2>/dev/null || echo "Warning: cannot hand /app/.env to $APP_USER; the setup wizard will not be able to save settings."
fi

nginx

cleanup() {
    echo "Shutting down..."
    nginx -s quit 2>/dev/null || true
    if [ -n "$NODE_PID" ]; then
        kill -TERM "$NODE_PID" 2>/dev/null || true
        wait "$NODE_PID" 2>/dev/null || true
    fi
    exit 0
}

trap cleanup TERM INT

cd /app/backend
su-exec "$APP_USER" node server.js &
NODE_PID=$!
wait "$NODE_PID"
cleanup
