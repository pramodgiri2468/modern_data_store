# 📬 Postman Testing Guide — IoThings Smart Gate Controller API

This project comes with a **complete, pre-configured Postman Collection (v2.1.0)** and **Environment configuration** designed for immediate testing of the **IoThings Smart House Main Gate Automation Controller**.

Every endpoint features pre-configured JSON request bodies, URL variables, query parameters, and **automated JavaScript test assertions** (`pm.test`).

---

## 📁 Included Files

| File | Location | Description |
| :--- | :--- | :--- |
| **Postman Collection** | [`postman/IoThings_Smart_Gate.postman_collection.json`](file:///Users/pramod/Desktop/Modern_data_stores/postman/IoThings_Smart_Gate.postman_collection.json) | **33 complete API requests** organized across 6 folders |
| **Postman Environment** | [`postman/IoThings_Local.postman_environment.json`](file:///Users/pramod/Desktop/Modern_data_stores/postman/IoThings_Local.postman_environment.json) | Variables: `baseUrl` (`http://localhost:3000`), `homeId`, `gateId`, `alertEmail` |
| **Root Copy (Collection)** | [`postman_collection.json`](file:///Users/pramod/Desktop/Modern_data_stores/postman_collection.json) | Root shortcut for 1-click import |
| **Root Copy (Environment)** | [`postman_environment.json`](file:///Users/pramod/Desktop/Modern_data_stores/postman_environment.json) | Root shortcut for 1-click import |

---

## ⚡ Step 1: Ensure Backend Server is Running

Before sending requests in Postman, ensure the core server is running on `http://localhost:3000`:

```bash
# Terminal 1: Ensure MongoDB 3-Node Replica Set is active
npm run cluster:start

# Terminal 2: Seed UK GDPR synthetic dataset (if not already seeded)
npm run seed

# Terminal 3: Start Core Server (Express REST API & MQTT Broker)
npm start
```

> **Verification:** In your browser or terminal, verify `curl http://localhost:3000/health` returns `{"status":"OK"}`.

---

## 🚀 Step 2: Open Postman & Import

You have Postman installed at `/Applications/Postman.app`.

### 1. Launch Postman
Open Postman from macOS Spotlight (`Cmd + Space` -> type `Postman`) or run in terminal:
```bash
open -a Postman
```

### 2. Import Collection and Environment
1. In the top-left corner of Postman, click the **Import** button (or press `Cmd + O`).
2. Drag and drop both files into the Postman window:
   - `postman/IoThings_Smart_Gate.postman_collection.json`
   - `postman/IoThings_Local.postman_environment.json`
   *(Alternatively, select the root files `postman_collection.json` and `postman_environment.json`)*
3. Click **Import**.

### 3. Select the Environment
In the **top-right corner** of Postman, click the environment dropdown (which currently says *No Environment*) and select:
👉 **`IoThings Local Development (localhost:3000)`**

---

## 🗂️ Step 3: API Request Catalog (6 Folders)

### 📂 Folder 1: System Health & Cluster Diagnostics
*Monitor infrastructure and MongoDB 3-Node Replica Set consensus.*
- `GET System Health Check` (`/health`): Heartbeat verification.
- `GET Cluster Diagnostics (MongoDB 3-Node Replica Set rs0)` (`/api/cluster/status`): Validates Primary node on `27017` and Secondaries on `27018` & `27019`, replication lag, and member health.

### 📂 Folder 2: Main Gate Hardware Commands & Physical Status
*Actuate physical gate components via MQTT.*
- `GET Live Gate Physical State` (`/api/gate/status`): Real-time leaf position, deadbolt lock, reed switch, and photocell beam continuity.
- `POST Command - OPEN Gate` (`/api/gate/command` with `action: "OPEN"`)
- `POST Command - CLOSE Gate` (`/api/gate/command` with `action: "CLOSE"`)
- `POST Command - UNLOCK Deadbolt` (`/api/gate/command` with `action: "UNLOCK"`)
- `POST Command - LOCK Deadbolt` (`/api/gate/command` with `action: "LOCK"`)
- `POST Command - EMERGENCY STOP` (`/api/gate/command` with `action: "STOP"`)
- `POST Command - SAFETY REVERSE` (`/api/gate/command` with `action: "SAFETY_REVERSE"`)

### 📂 Folder 3: 3-Core Sensors & Telemetry (Continuous 5-Min Intervals)
*Continuous time-series telemetry and interactive hardware simulation.*
- `GET Filtered Audit & Security Events` (`/api/sensors/events?homeId=home_uk_01&limit=20`): Query events with pagination.
- `POST Ingest Sensor Event (REST API Ingestion)` (`/api/sensors/event`): Direct REST event submission.
- `GET 5-Minute Time-Series Telemetry` (`/api/sensors/telemetry?limit=30`): 14-day continuous 5-minute sampling data.
- `POST On-Demand 5-Minute Telemetry Sample` (`/api/sensors/generate-telemetry`): Forces an on-demand 5-minute sample.
- **Hardware Simulator Triggers (`POST /api/sensors/simulate`):**
  - `POST Resident RFID Tap`: Simulates Dr. Jane Davies scanning RFID-8842-A (triggers Gate Open).
  - `POST Unauthorized RFID Intruder`: Simulates unregistered card tap (triggers Warning + Email Security Alert).
  - `POST Resident ALPR Vehicle`: Simulates Audi Q5 license plate scan `BC24-UKS`.
  - `POST Safety Obstacle Beam Broken`: Simulates obstruction (triggers Safety Auto-Reverse).
  - `POST Enclosure Tamper Alarm`: Simulates 3.8G accelerometer vibration (triggers Critical Intrusion Email).

### 📂 Folder 4: Access Control Policies (Automated Full CRUD & Verification)
*Complete credential lifecycle management with automatic variable propagation.*
1. `1. POST CRUD CREATE - Register New Access Credential` (`POST /api/policies`):
   - Creates a new RFID policy.
   - **Smart Test Script:** Automatically captures `policyId` and stores it into `{{createdPolicyId}}`!
2. `2. GET CRUD READ - List All Access Policies` (`GET /api/policies`): Lists all registered policies.
3. `3. GET CRUD READ - Single Policy by ID` (`GET /api/policies/{{createdPolicyId}}`): Reads the policy created in step 1.
4. `4. PUT CRUD UPDATE - Modify Policy Details` (`PUT /api/policies/{{createdPolicyId}}`): Updates role and holder name.
5. `5. POST Credential Verification - Authorized Entry` (`POST /api/policies/verify`): Verifies credential and triggers entry email.
6. `6. POST Credential Verification - Denied Unauthorized Attacker` (`POST /api/policies/verify`): Rejects unauthorized attempt.
7. `7. DELETE CRUD DELETE - Revoke Access Credential` (`DELETE /api/policies/{{createdPolicyId}}`): Deletes policy from database.

### 📂 Folder 5: Email Notifications & Security Intrusion Alerts
*Real-time transactional email notifications via Nodemailer.*
- `GET Query Dispatched Notification Logs` (`/api/notifications`): Query sent email history.
- `POST Trigger Authorized Entry Notification Email` (`/api/notifications/test`): Dispatches green authorized arrival email.
- `POST Trigger Unauthorized Intruder Security Alert Email` (`/api/notifications/test-unauthorized`): Dispatches red security alert email to `pg016742@gmail.com`.

### 📂 Folder 6: Predictive Analytics & Aggregation Pipelines
*MongoDB multi-stage aggregation queries.*
- `GET 24-Hour Peak Traffic Hourly Aggregation` (`/api/analytics/hourly-traffic`): 24 hourly buckets.
- `GET Security Incident Aggregation` (`/api/analytics/security`): Quantifies tampering, unauthorized tags, and obstacles.
- `GET Predictive Motor Health & Duty Cycle Forecast` (`/api/analytics/motor-health`): Motor cycle metrics and maintenance prediction.
- `GET 3-Core Sensor Health & Diagnostic Aggregation` (`/api/analytics/sensor-health`): Photocell, Limit Switch, and RFID reader health.
- `GET Executive Dashboard KPI Summary` (`/api/analytics/summary`): System-wide executive summary.

---

## 🧪 Step 4: Running the Entire Collection (Collection Runner)

To test all 33 endpoints and assertions at once:

1. In Postman, click on the collection root: **`IoThings Smart Gate Controller API`**.
2. Click the **Run** button (top right of the collection overview).
3. Ensure all requests are checked.
4. Set **Iterations:** `1`, **Delay:** `50 ms`.
5. Click **Run IoThings Smart Gate Controller API**.
6. **Watch the live results:** All tests will execute sequentially and show **100% PASS** (green)!

---

## 🖥️ Live Terminal Logger Confirmation

Whenever you hit any endpoint in Postman, the backend terminal prints a live formatted HTTP log:

```text
[HTTP API] ✓ GET /api/gate/status -> 200 (1ms)
[HTTP API] ✓ POST /api/gate/command -> 200 (8ms)
[HTTP API] ✓ POST /api/policies -> 201 (12ms)
[HTTP API] ✓ GET /api/analytics/sensor-health -> 200 (7ms)
```
