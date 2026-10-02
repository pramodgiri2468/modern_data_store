#!/usr/bin/env bash
echo "Stopping MongoDB 3-Node Replica Set..."
lsof -ti:27017,27018,27019 | xargs kill -9 2>/dev/null || true
pkill -f "mongod.*27017" || true
pkill -f "mongod.*27018" || true
pkill -f "mongod.*27019" || true
echo "All MongoDB cluster nodes stopped."
