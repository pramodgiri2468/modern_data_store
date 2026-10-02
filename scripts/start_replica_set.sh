#!/usr/bin/env bash
set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="$PROJECT_DIR/data"

echo "=========================================================="
echo " Starting MongoDB 3-Node Replica Set (rs0) for IoThings"
echo "=========================================================="

mkdir -p "$DATA_DIR/rs0-1" "$DATA_DIR/rs0-2" "$DATA_DIR/rs0-3"

# 1. Check for Homebrew background standalone service on port 27017
if command -v brew >/dev/null 2>&1 && brew services list 2>/dev/null | grep -q "mongodb-community.*started"; then
  echo "[Cluster] Detected active background Homebrew standalone MongoDB service."
  echo "[Cluster] Stopping 'mongodb-community' service to free port 27017 for replica set rs0..."
  brew services stop mongodb-community >/dev/null 2>&1 || true
  sleep 1
fi

# 2. Check and clean any existing standalone/stale instances on cluster ports
lsof -ti:27017,27018,27019 | xargs kill -9 2>/dev/null || true
pkill -f "mongod.*27017" || true
pkill -f "mongod.*27018" || true
pkill -f "mongod.*27019" || true
sleep 1

MONGOD_BIN="$(command -v mongod || echo '/opt/homebrew/bin/mongod')"
MONGOSH_BIN="$(command -v mongosh || echo '/opt/homebrew/bin/mongosh')"

if [ ! -x "$MONGOD_BIN" ]; then
  echo "Error: mongod binary not found at $MONGOD_BIN. Please install MongoDB."
  exit 1
fi

echo "Launching Node 1 (port 27017), Node 2 (port 27018), and Node 3 (port 27019)..."
python3 -c "
import os, sys

def launch(port, dbpath, logpath):
    pid = os.fork()
    if pid == 0:
        os.setsid()
        pid2 = os.fork()
        if pid2 == 0:
            os.execv('$MONGOD_BIN', [
                'mongod',
                '--port', str(port),
                '--dbpath', dbpath,
                '--replSet', 'rs0',
                '--bind_ip', '127.0.0.1',
                '--logpath', logpath,
                '--logappend'
            ])
        sys.exit(0)
    os.waitpid(pid, 0)

launch(27017, '$DATA_DIR/rs0-1', '$DATA_DIR/rs0-1/mongod.log')
launch(27018, '$DATA_DIR/rs0-2', '$DATA_DIR/rs0-2/mongod.log')
launch(27019, '$DATA_DIR/rs0-3', '$DATA_DIR/rs0-3/mongod.log')
"

echo "Waiting for cluster nodes to bind to ports..."
for i in {1..15}; do
  if lsof -i :27017 -sTCP:LISTEN >/dev/null 2>&1 && \
     lsof -i :27018 -sTCP:LISTEN >/dev/null 2>&1 && \
     lsof -i :27019 -sTCP:LISTEN >/dev/null 2>&1; then
    echo "✓ All 3 cluster nodes listening on ports 27017, 27018, 27019."
    break
  fi
  sleep 1
done

echo "Verifying Replica Set rs0 status..."
"$MONGOSH_BIN" --port 27017 --quiet --eval '
try {
  const status = rs.status();
  if (status.ok === 1) {
    console.log("Replica Set Status: OK! Set:", status.set);
    status.members.forEach(m => console.log(` - Node ${m.name}: ${m.stateStr} (Health: ${m.health})`));
  } else {
    throw new Error("Replica set not ok");
  }
} catch (e) {
  console.log("Initiating Replica Set rs0 with 3 cluster nodes...");
  const config = {
    _id: "rs0",
    members: [
      { _id: 0, host: "127.0.0.1:27017", priority: 2 },
      { _id: 1, host: "127.0.0.1:27018", priority: 1 },
      { _id: 2, host: "127.0.0.1:27019", priority: 1 }
    ]
  };
  rs.initiate(config);
}
'

echo "=========================================================="
echo " Replica Set rs0 is active and ready!"
echo " Primary: 127.0.0.1:27017 | Secondaries: 127.0.0.1:27018, 127.0.0.1:27019"
echo " Connection URI: mongodb://127.0.0.1:27017,127.0.0.1:27018,127.0.0.1:27019/iothings_gate?replicaSet=rs0"
echo "=========================================================="
