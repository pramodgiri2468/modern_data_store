#!/usr/bin/env bash

echo "=========================================================="
echo " Checking MongoDB Replica Set Replication (rs0)"
echo "=========================================================="

for port in 27017 27018 27019; do
  echo "--- Node on Port $port ---"
  mongosh --port $port iothings_gate --quiet --eval '
    db.getMongo().setReadPref("secondary");
    const collections = ["gate_devices", "access_policies", "gate_events", "gate_telemetry"];
    collections.forEach(col => {
      try {
        console.log("  " + col.padEnd(16) + ": " + db[col].countDocuments() + " records");
      } catch (e) {
        console.log("  " + col.padEnd(16) + ": error (" + e.message + ")");
      }
    });
  '
  echo ""
done

echo "=========================================================="
echo " Replication Lag & Status:"
mongosh --port 27017 --quiet --eval 'rs.printSecondaryReplicationInfo()'
echo "=========================================================="
