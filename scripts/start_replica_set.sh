#!/usr/bin/env bash
set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="$PROJECT_DIR/data"

echo "=========================================================="
echo " Starting MongoDB 3-Node Replica Set (rs0) for IoThings"
echo "=========================================================="

mkdir -p "$DATA_DIR/rs0-1" "$DATA_DIR/rs0-2" "$DATA_DIR/rs0-3"

# Check if already running
if pgrep -f "mongod.*27017" >/dev/null && pgrep -f "mongod.*27018" >/dev/null && pgrep -f "mongod.*27019" >/dev/null; then
  echo "MongoDB 3-Node Replica Set is already running."
else
  pkill -f "mongod.*27017" || true
  pkill -f "mongod.*27018" || true
  pkill -f "mongod.*27019" || true
  sleep 1

  echo "Starting Node 1 (Primary candidate) on port 27017..."
  nohup /opt/homebrew/bin/mongod --port 27017 --dbpath "$DATA_DIR/rs0-1" --replSet rs0 --bind_ip 127.0.0.1 </dev/null > "$DATA_DIR/rs0-1/mongod.log" 2>&1 & disown
  
  echo "Starting Node 2 (Secondary candidate) on port 27018..."
  nohup /opt/homebrew/bin/mongod --port 27018 --dbpath "$DATA_DIR/rs0-2" --replSet rs0 --bind_ip 127.0.0.1 </dev/null > "$DATA_DIR/rs0-2/mongod.log" 2>&1 & disown

  echo "Starting Node 3 (Secondary candidate) on port 27019..."
  nohup /opt/homebrew/bin/mongod --port 27019 --dbpath "$DATA_DIR/rs0-3" --replSet rs0 --bind_ip 127.0.0.1 </dev/null > "$DATA_DIR/rs0-3/mongod.log" 2>&1 & disown

  echo "Waiting 3 seconds for cluster nodes..."
  sleep 3
fi

echo "Verifying Replica Set rs0 status..."
/opt/homebrew/bin/mongosh --port 27017 --eval '
try {
  const status = rs.status();
  console.log("Replica Set Status: OK! Set:", status.set);
  status.members.forEach(m => console.log(` - Node ${m.name}: ${m.stateStr} (Health: ${m.health})`));
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
