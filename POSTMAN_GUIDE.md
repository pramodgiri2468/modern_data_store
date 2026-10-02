# Postman Testing Guide

This directory contains a pre-configured Postman collection and environment to test the IoThings Smart Gate API.

## Files

- **Collection:** [`postman/IoThings_Smart_Gate.postman_collection.json`](file:///Users/pramod/Desktop/Modern_data_stores/postman/IoThings_Smart_Gate.postman_collection.json) (or root [`postman_collection.json`](file:///Users/pramod/Desktop/Modern_data_stores/postman_collection.json))
- **Environment:** [`postman/IoThings_Local.postman_environment.json`](file:///Users/pramod/Desktop/Modern_data_stores/postman/IoThings_Local.postman_environment.json) (or root [`postman_environment.json`](file:///Users/pramod/Desktop/Modern_data_stores/postman_environment.json))

## Quick Setup

### 1. Start the backend

Make sure MongoDB and the backend server are running:

```bash
# Start MongoDB replica set
npm run cluster:start

# Seed sample data (first time only)
npm run seed

# Start API server and MQTT broker
npm start
```

Verify the server is up:
```bash
curl http://localhost:3000/health
```

### 2. Import into Postman

1. Open Postman.
2. Click **Import** (top left, or `Cmd + O` on macOS).
3. Drag and drop both JSON files:
   - `postman/IoThings_Smart_Gate.postman_collection.json`
   - `postman/IoThings_Local.postman_environment.json`
4. In the top-right environment selector, choose **IoThings Local Development (localhost:3000)**.

## Collection Overview

The collection contains 36 requests organized into 6 folders:

### 1. System Health & Cluster Diagnostics (2 requests)
- `GET /health` — Basic health check
- `GET /api/cluster/status` — MongoDB replica set (`rs0`) status and node topology

### 2. Main Gate Hardware Commands & Physical Status (7 requests)
- `GET /api/gate/status` — Current physical state (leaf position, lock, reed switch, beam)
- `POST /api/gate/command` — Gate actions: `OPEN`, `CLOSE`, `LOCK`, `UNLOCK`, `STOP`, `SAFETY_REVERSE`

### 3. 3-Core Sensors & Telemetry (12 requests)
- `GET /api/sensors/events` — Query gate audit events
- `POST /api/sensors/event` — Ingest sensor events via REST
- `GET /api/sensors/telemetry` — Query recent time-series telemetry records
- `POST /api/sensors/generate-telemetry` — On-demand telemetry sample generation
- `POST /api/sensors/unauthorized` — Ingest unauthorized intrusion event (keeps gate locked, triggers alert email)
- `POST /api/sensors/simulate` — Hardware simulations:
  - Resident RFID tap (`RFID-8842-A`)
  - Unauthorized RFID intruder
  - Unauthorized person perimeter intrusion
  - Resident vehicle plate (`BC24-UKS`)
  - Unauthorized vehicle plate
  - Safety photocell beam obstruction
  - Enclosure tamper vibration

### 4. Access Control Policies — CRUD & Verification (7 requests)
Demonstrates the full lifecycle of an access policy:
1. `POST /api/policies` — Create new credential policy (saves `policyId` to `{{createdPolicyId}}`)
2. `GET /api/policies` — List all policies
3. `GET /api/policies/{{createdPolicyId}}` — Retrieve created policy
4. `PUT /api/policies/{{createdPolicyId}}` — Update policy holder name/role
5. `POST /api/policies/verify` — Verify authorized credential (quiet entry, gate unlocks)
6. `POST /api/policies/verify` — Verify unauthorized credential (rejected, triggers alert email)
7. `DELETE /api/policies/{{createdPolicyId}}` — Revoke and delete credential

### 5. Email Notifications (3 requests)
- `GET /api/notifications` — View dispatched email logs
- `POST /api/notifications/test` — Test authorized access (confirms emails are suppressed for routine entry)
- `POST /api/notifications/test-unauthorized` — Trigger unauthorized intruder alert email to `pg016742@gmail.com`

### 6. Analytics & Aggregation Pipelines (5 requests)
- `GET /api/analytics/hourly-traffic` — 24-hour traffic aggregation
- `GET /api/analytics/security` — Security incidents breakdown
- `GET /api/analytics/motor-health` — Motor duty cycles and maintenance score
- `GET /api/analytics/sensor-health` — Photocell flux, limit switch boundary ratio, RFID noise floor
- `GET /api/analytics/summary` — High-level KPI summary

## Running the Collection Runner

You can run all 36 requests automatically:

1. Select the **IoThings Smart Gate Controller API** collection in the sidebar.
2. Click **Run**.
3. Choose the **IoThings Local Development (localhost:3000)** environment.
4. Keep the default order (requests in Folder 4 rely on `createdPolicyId` from step 1).
5. Click **Run IoThings Smart Gate Controller API**.

All tests should pass with status 200/201.

## Troubleshooting

- **Connection refused on port 3000:** Make sure `npm start` is running in a terminal.
- **`createdPolicyId` is empty:** If running requests individually, run request `1. POST CRUD CREATE` first so Postman populates the environment variable.
- **Email alerts:** By default, emails use Ethereal (preview links are logged to the terminal and returned in the response). For real Gmail delivery, configure `SMTP_USER` and `SMTP_PASS` in `.env`.

