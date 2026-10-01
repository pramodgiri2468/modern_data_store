#!/usr/bin/env bash
echo "Stopping MongoDB 3-Node Replica Set..."
pkill -f "mongod.*27017" || true
pkill -f "mongod.*27018" || true
pkill -f "mongod.*27019" || true
echo "All MongoDB cluster nodes stopped."
