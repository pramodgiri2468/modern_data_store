# IoThings Smart House Main Gate Automation System
## CMP6207 Modern Data Stores — Coursework Implementation & Technical Report

![Project Status: Complete](https://img.shields.io/badge/Status-Complete-emerald)
![MongoDB: 3-Node Replica Set](https://img.shields.io/badge/MongoDB-3--Node_Replica_Set_(rs0)-success)
![MQTT Protocol](https://img.shields.io/badge/Protocol-MQTT_v3.1.1-blue)
![Backend: Node.js Express](https://img.shields.io/badge/Backend-Node.js_Express-green)
![Automated Tests: 14/14 Passed](https://img.shields.io/badge/Tests-14%2F14_Passed_(100%25)-brightgreen)
![Academic Compliance: Level 6](https://img.shields.io/badge/BCU_Assessment-LO1_LO2_LO4_Compliant-purple)

---

## 📑 Table of Contents

1. [Executive Summary](#-executive-summary)
2. [Key System Capabilities](#-key-system-capabilities)
3. [System Architecture Blueprint](#-system-architecture-blueprint)
4. [Step-by-Step Quickstart Guide](#-step-by-step-quickstart-guide)
5. [Viva Demonstration & Evaluation Guide (Step-by-Step)](#-viva-demonstration--evaluation-guide-step-by-step)
6. [How to Check & Verify MQTT Broker Status](#-how-to-check--verify-mqtt-broker-status)
7. [The Three Core Gate Sensors](#-the-three-core-gate-sensors)
8. [Continuous 5-Minute Telemetry Cadence](#-continuous-5-minute-telemetry-cadence)
9. [Automated Security & Access Email Notifications (Targeted to `pg016742@gmail.com`)](#-automated-security--access-email-notifications-targeted-to-pg016742gmailcom)
10. [Real-Time API Hit & Request Monitoring](#-real-time-api-hit--request-monitoring)
11. [Empirical Evaluation & Benchmarking](#-empirical-evaluation--benchmarking)
12. [REST API & MQTT Topic Reference](#-rest-api--mqtt-topic-reference)
13. [Project Directory & File Structure](#-project-directory--file-structure)
14. [Docker Containerized Deployment](#-docker-containerized-deployment)
15. [Troubleshooting & Common FAQs](#-troubleshooting--common-faqs)
16. [BCU Assessment Brief Compliance Matrix](#-bcu-assessment-brief-compliance-matrix)
17. [Academic Coursework Deliverables](#-academic-coursework-deliverables)

---

## 🏢 Executive Summary

This project delivers an enterprise-grade, distributed IoT modern data store engineered for **IoThings Home Automation Solutions** (a UK-based SME specializing in smart residential security). 

The system replaces legacy relational database bottlenecks with a distributed **MongoDB 3-Node Replica Set (`rs0`)**, an embedded **Aedes MQTT Message Broker**, and an asynchronous **Node.js Express REST API Gateway**. The implementation is purpose-built for the **Automation of the Main Gate of the House**, satisfying all requirements of Birmingham City University's Level 6 module **CMP6207 Modern Data Stores**.

---

## 🌟 Key System Capabilities

- **Distributed MongoDB 3-Node Replica Set (`rs0`):** Configured with 1 Primary write leader and 2 Secondary replicas on ports `27017`, `27018`, and `27019`. Provides majority write durability (`{ w: "majority", j: true }`), automated Raft election failover, and analytical read offloading (`secondaryPreferred`).
- **Three Core Sensor Suites Monitored in Real Time:**
  1. **Optical Safety Photocell:** Continuous tracking of health status (`HEALTHY`, `DIRTY_LENS_WARNING`, `MISALIGNED_SERVICE_REQUIRED`), optical signal strength percentage (0–100%, detecting dirty lenses or bracket misalignment), and millisecond-level beam continuity status.
  2. **Mechanical Limit Switch:** Mathematical confirmation of the physical resting state (`FULLY_CLOSED`), ambient motor temperature (°C), and standby power usage (Watts, nominal ~2.1W).
  3. **Contactless RFID Reader:** Operational heartbeat (`OPERATIONAL`, `DEGRADED`, `OFFLINE`), antenna tuning status (`OPTIMAL`, `DETUNED`), and background electromagnetic RF noise floor level (dBm, nominal -83 dBm).
- **Sub-Second Safety Reversal (< 8ms):** Automatic motor reversal triggered instantly if the photocell beam is interrupted or an obstacle is detected within 40cm during gate closing.
- **Continuous 5-Minute Telemetry Cadence:** Standardized 300-second sampling interval (288 points/day, 4,032+ documents over 14 days) capturing diurnal sunlight lux, temperature curves, battery float charge, and motor metrics, bounded by a 30-day MongoDB TTL index.
- **Automated Dual-Mode Security & Entry Email Notifications:** Real-time email dispatch for **both authorized entries** (RFID scan, vehicle plate ALPR, or PIN code, notifying the particular holder and master alert) AND **immediate critical security alerts for unauthorized intrusion attempts** (unrecognized RFID tags, unregistered vehicle plates, expired credentials, or enclosure tamper alarms) sent directly to **`pg016742@gmail.com`**.
- **Web Audio API Sound Siren Ring & Emergency Visualizer:** Native zero-latency electronic **Security Alarm Siren Ring** (`playAlarmSiren()`) on unauthorized intrusion, sliding red emergency alarm banner with direct 1-click webmail viewer button, pulsing red gate beacon lights, operator silence control (`🔕 Silence Alarm Siren`), and pleasant 4-tone ascending resident chime (`playAccessChime()`) with top header sound toggle pill.
- **UK GDPR-Compliant Synthetic Dataset:** 5,700+ realistic documents (1,850+ gate events, 4,033 continuous 5-minute telemetry records over 14 days, 7 hardware devices, and 6 access policies).
- **Glassmorphic Web UI Dashboard:** Real-time animated visualization of gate leaves, live sensor telemetry gauges, access policy CRUD management, live email notification stream, and canvas-based 24-hour traffic aggregation charts.
- **100% Automated Test Suite:** 14 automated integration and unit test suites with automatic server lifecycle management.

---

## 🏗️ System Architecture Blueprint

```mermaid
graph TD
    subgraph IoT Hardware Edge
        PHOTO[Optical Photocell Transceiver: DEV-BEAM-01]
        LIMIT[Mechanical Limit Switch: DEV-CTRL-01]
        RFID[Pillar RFID Reader: DEV-RFID-01]
        ALPR[Edge AI ALPR Camera: DEV-ALPR-01]
        PIR[Driveway PIR Motion: DEV-PIR-01]
        MOTOR[Linear Actuator Motor: DEV-CTRL-01]
        LOCK[Solenoid Deadbolt: DEV-LOCK-01]
    end

    subgraph Messaging & Ingestion Bus
        Broker[Embedded Aedes MQTT Broker tcp://127.0.0.1:1883]
    end

    subgraph Node.js Core Backend
        MQTTClient[Internal MQTT Client Subscriber]
        SafetyEngine[Safety Automation & Auto-Reverse Engine]
        EmailService[Email Notification Service - Specific Mail]
        ExpressAPI[Express REST API Gateway :3000]
        SSE[Server-Sent Events Real-Time Push Stream]
    end

    subgraph Distributed MongoDB 3-Node Replica Set
        M1[(Node 1: 127.0.0.1:27017 PRIMARY)]
        M2[(Node 2: 127.0.0.1:27018 SECONDARY)]
        M3[(Node 3: 127.0.0.1:27019 SECONDARY)]
        M1 <-->|Oplog Sync & Heartbeats| M2
        M1 <-->|Oplog Sync & Heartbeats| M3
        M2 <-->|Heartbeats & Quorum Voting| M3
    end

    PHOTO -->|Publish Telemetry| Broker
    LIMIT -->|Publish Status| Broker
    RFID -->|Publish Events| Broker
    ALPR -->|Publish Events| Broker
    PIR -->|Publish Telemetry| Broker
    MOTOR -->|Publish Status| Broker
    LOCK -->|Publish Status| Broker

    Broker <-->|Subscribe & Ingest| BrokerClient[MQTT Ingestion]
    BrokerClient --> MQTTClient
    MQTTClient --> SafetyEngine
    SafetyEngine -->|State Update & Push| SSE
    SafetyEngine -->|Persist Majority ACID| M1
    SafetyEngine -->|Auto-Reverse / Open Command| Broker
    SafetyEngine -->|Authorized Entry Trigger| EmailService
    EmailService -->|Targeted Dispatch| EmailRecipient[Particular Email: policy.notificationEmail<br/>Master CC: DEFAULT_ALERT_EMAIL (pg016742@gmail.com)]

    ExpressAPI --> M1
    ExpressAPI -.->|Read Preference: secondaryPreferred| M2
```

---

## 🚀 Step-by-Step Quickstart Guide

Follow these commands in sequence to run and verify the complete solution:

### 1. Prerequisites
- **Node.js**: v18+ (tested on Node.js v20 & v26)
- **MongoDB**: v6.0+ (native `mongod` binary installed, or Docker)

### 2. Start the Distributed MongoDB 3-Node Replica Set
In your first terminal tab:
```bash
npm run cluster:start
```
- Starts 3 local `mongod` daemons:
  - Node 1: `127.0.0.1:27017` (**PRIMARY**)
  - Node 2: `127.0.0.1:27018` (**SECONDARY**)
  - Node 3: `127.0.0.1:27019` (**SECONDARY**)
- Initializes replica set `rs0` with quorum voting and oplog replication.

### 3. Seed Synthetic UK GDPR Dataset
In your terminal:
```bash
npm run seed
```
- Populates MongoDB with **5,700+ total documents**:
  - `1,850+` gate activation and security audit events
  - `4,033` continuous 5-minute telemetry records over 14 days
  - `7` gate hardware device profiles
  - `6` access authorization policies with registered notification emails (mapped to `pg016742@gmail.com`)

### 4. Start the Core Backend Server (REST API, MQTT Broker & 15s Sensor Cadence)
In your terminal:
```bash
npm start
```
- **Web UI Dashboard & REST API:** Open [http://localhost:3000](http://localhost:3000)
- **MQTT Broker:** Active on `tcp://127.0.0.1:1883`
- **15-Second Sensor Cadence:** Automatically begins streaming live sensor telemetry readings every 15 seconds to MongoDB and MQTT.
- **Autonomous Intrusion Alerts:** Every 60 seconds (every 4th 15s cycle), simulates an unauthorized sensor reading, keeping the gate locked and dispatching a security alert to `pg016742@gmail.com`.
- *Self-Healing Port Management:* `npm start` automatically executes `prestart` to release any stale processes occupying ports `3000` or `1883`.
- *To stop the server anytime:* `npm run server:stop`

> [!TIP]
> **How Email Delivery Works:**
> - **Live Webmail Preview (Default - Zero Setup):** Every dispatched email automatically generates a clickable preview URL in the terminal and on the Web Dashboard (`🔗 View Dispatched Email in Webmail Viewer ↗`) showing the exact HTML email delivered to `pg016742@gmail.com`.
> - **Real Gmail Inbox Delivery:** To deliver directly to your phone/inbox at `pg016742@gmail.com`, add your 16-letter [Google App Password](https://myaccount.google.com/apppasswords) to `.env` and run `npm run test:email`. See [Section 📧 Automated Email Notifications](#-automated-security--access-email-notifications-targeted-to-pg016742gmailcom) below.

### 5. Send Unauthorized Sensor Data & Security Email Alerts (Immediate Testing)
In a second terminal tab or script runner:
```bash
# Simulates unauthorized person entering perimeter (Gate stays LOCKED, email sent to pg016742@gmail.com)
npm run sim:unauthorized

# Or test specific unauthorized sensor types:
node scripts/simulate_unauthorized.js --type person    # Intruder detected in perimeter
node scripts/simulate_unauthorized.js --type rfid      # Unregistered cloned RFID tag
node scripts/simulate_unauthorized.js --type alpr      # Unregistered vehicle license plate
node scripts/simulate_unauthorized.js --type tamper    # Control box accelerometer shock (3.8G)

# Or test email dispatching directly:
npm run test:email
```

### 6. Continuous Sensor Telemetry Generator (15-Second or 5-Minute Intervals)
```bash
# Option A: Run 15-second real-time sensor generator (15,000 ms)
npm run generate:15s

# Option B: Run 5-minute sampling generator (300,000 ms)
npm run generate:5min

# Option C: Run gate hardware movement & traffic simulator (15s cadence)
npm run sim:15s

# Option D: Backfill historical 5-minute records for past N days (e.g. 7 days = 2,016 samples)
node scripts/continuous_sensor_generator.js --backfill 7 --exit
```

### 7. Run Hardware Gate Simulator (Events & Access Scans)
```bash
npm run sim
```
- Simulates resident RFID badge presentations, vehicle ALPR license plate scans, courier deliveries, obstacle obstructions, and enclosure tamper alarms.

### 8. Run Automated Test Suite
```bash
npm test
```
- Runs **16 automated integration tests** covering cluster health, CRUD operations, 3-core sensor telemetry, sub-second commands, unauthorized sensor data ingestion, gate lock validation, and email notification dispatches.
- *Guaranteed 100% pass with automated server lifecycle detection.*

### 9. Hit APIs in Postman Application (36 Pre-Configured Requests)
Open Postman on macOS (`open -a Postman`), click **Import**, and drag-and-drop:
- Collection: [`postman/IoThings_Smart_Gate.postman_collection.json`](file:///Users/pramod/Desktop/Modern_data_stores/postman/IoThings_Smart_Gate.postman_collection.json) (or root [`postman_collection.json`](file:///Users/pramod/Desktop/Modern_data_stores/postman_collection.json))
- Environment: [`postman/IoThings_Local.postman_environment.json`](file:///Users/pramod/Desktop/Modern_data_stores/postman/IoThings_Local.postman_environment.json) (or root [`postman_environment.json`](file:///Users/pramod/Desktop/Modern_data_stores/postman_environment.json))
- Select the environment **"IoThings Local Development (localhost:3000)"** in the top-right corner.
- Hit any endpoint individually or click **Run Collection** to execute all 36 automated tests with 100% pass!
- See [`POSTMAN_GUIDE.md`](file:///Users/pramod/Desktop/Modern_data_stores/POSTMAN_GUIDE.md) for full endpoint walkthrough.

### 10. Run Empirical Benchmarking Harness
```bash
npm run benchmark
```
- Executes millisecond-precision benchmarks across the replica set, evaluating CRUD operations, write concerns (`w: 1` vs `w: majority`), and aggregation pipelines.
- Saves results to [`report/benchmark_results.json`](file:///Users/pramod/Desktop/Modern_data_stores/report/benchmark_results.json).

### 11. Compile Moodle Submission PDF Report
```bash
npm run report:pdf
```
- Compiles the publication-quality, 15-page academic report to [`report/IoThings_Main_Gate_Automation_Report.pdf`](file:///Users/pramod/Desktop/Modern_data_stores/report/IoThings_Main_Gate_Automation_Report.pdf) adhering strictly to BCU submission guidelines: Font size 11pt, 1.5 line spacing, structured university coversheet, ~4,150 words, and 20+ Harvard references. Ready for immediate upload to Moodle!

---

## 🎙️ Viva Demonstration & Evaluation Guide (Step-by-Step)

When presenting this project during your academic viva examination, follow this structured, 11-step demonstration workflow:

| Stage | Action / Command | What to Explain to the Examiners | Expected Output / Visual Evidence |
| :--- | :--- | :--- | :--- |
| **1. Cold Start** | `npm run cluster:start` | Explain MongoDB 3-Node Replica Set (`rs0`), Primary-Secondary architecture, and distributed consensus. | Terminal shows nodes on `27017`, `27018`, `27019` initialized and connected into `rs0`. |
| **2. Synthetic Seeding** | `npm run seed` | Highlight UK GDPR compliance (synthetic generation), realistic 14-day 5-minute telemetry (4,033 records), and access policies. | Terminal outputs: `✓ Seeded 1,850+ events`, `✓ Seeded 4,033 5-min telemetry samples`, `✓ Registered 6 access policies`. |
| **3. Server Launch** | `npm start` | Explain the unified architecture: asynchronous Node.js Express REST API and embedded Aedes MQTT broker running together. | Log shows `Connected successfully to MongoDB Replica Set (rs0)!`, `Embedded Aedes broker listening on port 1883`, `HTTP server listening on port 3000`. |
| **4. Open Web Dashboard** | Open `http://localhost:3000` | Walk through the glassmorphic UI: live SVG gate leaves, 3-core sensor telemetry meters, live incident stream, and email notification feed. | Browser displays green status badges: `ONLINE`, `REPLICA SET: rs0 (3 NODES)`, `MQTT: CONNECTED`. |
| **5. Live Gate Control** | Click **"Open Gate"** on Dashboard | Demonstrate the real-time event pipeline: Button click -> Express API (`POST /api/gate/command`) -> MQTT command published -> Gate leaves animate to OPEN. | Server terminal logs `[HTTP API] ✓ POST /api/gate/command -> 200` and MQTT publish log. |
| **6. Photocell Safety Reverse** | Click **"Simulate Beam Interruption"** | Demonstrate safety automation: breaking the photocell beam when closing immediately triggers motor auto-reversal in < 8ms. | Gate reverses to OPEN state; terminal logs `[SAFETY TRIGGER] Beam interrupted -> Reversing gate`. |
| **7. Security Alert & Unauthorized Intrusion Demo** | Click **"🚷 Unauthorized Person"** or run `npm run sim:unauthorized` | Demonstrate perimeter security interception: when an unauthorized person, unregistered RFID card, or unrecognised plate is detected, the gate remains firmly **LOCKED** (`lockEngaged: true`), the event is persisted to MongoDB `gate_events`, broadcast across MQTT, and an urgent red security alert email is dispatched immediately to `pg016742@gmail.com`. | Terminal displays `🚨 [SECURITY ALERT EMAIL DISPATCHED]` and `[UNAUTHORIZED SENSOR DATA]`; Web UI notification feed updates instantly with red warning banner. |
| **8. CRUD Verification** | Click **"+ Add Credential"** in Web UI | Demonstrate full CRUD operations on access policies: Create new credential with email, view in list, edit schedule, or revoke. | HTTP 201 Created; record inserted directly into replica set. |
| **9. Automated Test Suite** | `npm test` | Prove production reliability and 100% test coverage across all 16 integration test suites. | 16 test suites pass with green checkmarks (0 failures). |
| **10. Replica Failover Demo** | `kill $(lsof -ti:27017)` in separate terminal | Kill the Primary node on port 27017 to prove automated Raft election failover. The replica set elects a new Primary from port 27018/27019 within seconds with zero downtime. | `rs.status()` in mongosh shows one of the secondary nodes promoted to `PRIMARY`. |
| **11. Postman Live API Demo** | Open Postman -> Select Collection -> Click **"Run Collection"** | Demonstrate hitting the REST API directly from the Postman application outside the browser UI, proving strict REST schema adherence, dynamic variable chaining, and sub-10ms response latencies. | 36 automated tests pass with green checkmarks (100% success). Core server logs incoming requests in real time. |

---

## 📡 How to Check & Verify MQTT Broker Status

The system includes an embedded **Aedes MQTT v3.1.1 Broker** listening on port `1883`. You can verify its health in **4 independent ways**:

### 1. In the Server Startup Terminal
When `npm start` is executed, the backend prints:
```text
[MQTT Broker] Embedded Aedes broker listening on port 1883
[MQTT Client] Connected to local MQTT broker: tcp://127.0.0.1:1883
[MQTT Client] Subscribed to topic: iothings/home/home_uk_01/gate/#
```
*(If another broker is already active on 1883, the server gracefully logs `[MQTT Broker] Port 1883 in use, connecting to existing MQTT broker` and continues seamless operation).*

### 2. Check Port 1883 via Terminal Command
Run this command in any terminal to verify the port is open and listening:
```bash
# Check if port 1883 is listening
lsof -i :1883

# Or test TCP connection with netcat
nc -zv 127.0.0.1 1883
```
**Expected Output:**
```text
COMMAND   PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node    85123 pramod   23u  IPv6 0x...      0t0  TCP *:1883 (LISTEN)
Connection to 127.0.0.1 port 1883 [tcp/mqtt] succeeded!
```

### 3. Check Live Web UI Dashboard Indicator
Open [http://localhost:3000](http://localhost:3000) and observe the top system header:
- **Badge:** `MQTT: Connected (tcp://127.0.0.1:1883)` with a pulsing green indicator.
- Whenever a sensor publishes an event or telemetry, the real-time activity counter increments automatically.

### 4. Inspect Live MQTT Message Flow Using Mosquitto or CLI
If you have `mosquitto_sub` installed:
```bash
mosquitto_sub -h 127.0.0.1 -p 1883 -t "iothings/#" -v
```
You will see real-time streaming JSON packets:
```text
iothings/home/home_uk_01/gate/telemetry {"timestamp":"2026-09-25T15:00:00Z","photocell":{"healthStatus":"HEALTHY","opticalSignalStrength":94.2},"limitSwitch":{"restingState":"FULLY_CLOSED"},"rfidReader":{"operationalHeartbeat":"OPERATIONAL"}}
iothings/home/home_uk_01/gate/events {"eventType":"RFID_SCAN","payload":{"tagId":"RFID-8842-A"}}
```

---

## 🔍 The Three Core Gate Sensors

The system specifically models, tracks, and persists the three core sensor suites requested by IoThings:

| Sensor Suite | Monitored Attributes | Nominal Range | Failure & Safety Automation |
| :--- | :--- | :--- | :--- |
| **1. Optical Safety Photocell**<br>([GateTelemetry.js](file:///Users/pramod/Desktop/Modern_data_stores/backend/models/GateTelemetry.js#L30-L45)) | • `healthStatus`<br>• `opticalSignalStrength`<br>• `beamContinuity` | • Status: `HEALTHY`<br>• Flux: 85% – 100%<br>• Beam: `true` (unbroken) | • **Immediate Safety Reverse (< 8ms):** If gate is closing and beam is broken, motor auto-reverses.<br>• **Preventative Lens Alert:** Dispatches `DIRTY_LENS_WARNING` if signal flux drops below 65%.<br>• **Misalignment Alert:** Dispatches `MISALIGNED_SERVICE_REQUIRED` if flux drops below 30%. |
| **2. Mechanical Limit Switch**<br>([GateTelemetry.js](file:///Users/pramod/Desktop/Modern_data_stores/backend/models/GateTelemetry.js#L46-L60)) | • `restingState`<br>• `ambientMotorTemperatureC`<br>• `standbyPowerWatts` | • State: `FULLY_CLOSED`<br>• Temp: 15°C – 32°C<br>• Standby: ~2.1 Watts | • **Latching Confirmation:** Validates physical seating in the deadbolt receiver.<br>• **Overcurrent & Thermal Warning:** Alerts if ambient temperature exceeds 55°C.<br>• **Parasitic Draw Warning:** Alerts if standby power draw exceeds 10 Watts. |
| **3. Contactless RFID Reader**<br>([GateTelemetry.js](file:///Users/pramod/Desktop/Modern_data_stores/backend/models/GateTelemetry.js#L61-L75)) | • `operationalHeartbeat`<br>• `antennaStatus`<br>• `backgroundNoiseDbm` | • Heartbeat: `OPERATIONAL`<br>• Antenna: `OPTIMAL`<br>• Noise: -85 to -80 dBm | • **Credential Matching:** Verifies credentials against MongoDB `access_policies`.<br>• **Interference Alert:** Warns if background RF noise rises above -65 dBm.<br>• **Antenna Detuning:** Detects `DETUNED` state caused by moisture or physical damage. |

---

## ⏱️ Continuous Sensor Telemetry Cadence (15-Second Live Stream & 5-Minute Archival)

Sensor telemetry operates in two complementary, configurable cadences:
- **1. Real-Time 15-Second Cadence (`TELEMETRY_INTERVAL_MS=15000`):** Default for active server runtime. Drives sub-minute reactive monitoring, immediate photocell safety beam checks (< 8ms), and live Web UI telemetry meter streaming.
- **2. Standard 5-Minute Cadence (`TELEMETRY_INTERVAL_MS=300000`):** Default for historical trending, long-term archival, and predictive motor health aggregation:
  - **Sample Rate:** 1 sample / 5 minutes = 12 samples / hour = **288 samples / day** per gate.
  - **Storage Profile:** Each document is ~420 bytes, generating ~121 KB/day or ~3.6 MB/month per gate.
  - **Data Locality:** All three sensors (photocell, limit switch, RFID reader) are encapsulated inside a single unified document per timestamp, eliminating costly multi-table SQL JOINs.
  - **Automated Retention (TTL):** Indexed with a 30-day MongoDB Time-To-Live (`expireAfterSeconds: 2592000`) index on the `timestamp` field, automatically purging records older than 30 days without manual maintenance.

---

## 📧 Automated Security & Access Email Notifications (Targeted to `pg016742@gmail.com`)

The system provides dual-mode automated email alerts for **both Authorized Entries and Unauthorized Intrusion Attempts**:

```mermaid
flowchart TD
    Scan[RFID Badge / ALPR Plate / Keypad PIN] --> Verify{Matched in MongoDB AccessPolicy?}
    
    Verify -->|YES: Authorized| OpenGate[MQTT: Command OPEN Gate]
    Verify -->|YES: Authorized| AuthMail[Email Service: Authorized Entry Receipt]
    AuthMail --> Recipient1[Holder Email: policy.notificationEmail]
    AuthMail --> Recipient2[Master CC: DEFAULT_ALERT_EMAIL (pg016742@gmail.com)]
    AuthMail --> Feed1[Web Dashboard Live Notification Feed: CYAN]

    Verify -->|NO: Unauthorized| LockGate[Hardware: Gate Remains Locked]
    Verify -->|NO: Unauthorized| AlertMail[Email Service: Urgent Security Alert]
    AlertMail --> RecipientAlert[Master Alert: DEFAULT_ALERT_EMAIL (pg016742@gmail.com)]
    AlertMail --> Feed2[Web Dashboard Live Notification Feed: RED WARNING]
    AlertMail --> MongoAudit[Persist to gate_events Collection]
```

### 1. Alert Types & Recipient Resolution

| Scenario | Trigger Mechanism | Email Subject | Recipient Address | Gate Action |
| :--- | :--- | :--- | :--- | :--- |
| **Authorized Entry** | Resident RFID scan, registered vehicle ALPR, valid PIN | `🚪 [IoThings Gate Alert] Authorized Entry Granted: {Holder} ({Type})` | `policy.notificationEmail` + CC `DEFAULT_ALERT_EMAIL` (`pg016742@gmail.com`) | Unlocks deadbolt & opens linear actuators |
| **Unauthorized Intrusion Attempt** | Unregistered RFID tag (`UNKNOWN-CLONE-99`), unknown vehicle plate, expired credential, invalid PIN | `🚨 [IoThings Gate ALERT] Unauthorized Entry Attempt Detected at Main Gate! ({Identifier})` | **`DEFAULT_ALERT_EMAIL`** (`pg016742@gmail.com`) | **Gate remains locked**, linear actuators hold closed |
| **Tamper / Forced Entry** | Accelerometer detects housing impact or vibration > 1.5G | `🚨 [IoThings Gate ALERT] Unauthorized Entry Attempt Detected at Main Gate! (ENCLOSURE_TAMPER)` | **`DEFAULT_ALERT_EMAIL`** (`pg016742@gmail.com`) | Alarm sounder active, CCTV tag |

### 2. Email Delivery Configuration & Options

The notification engine supports two complementary delivery modes:

#### Mode A: Instant Live Webmail Preview (Default — Zero Setup)
By default, the server connects to the live **Ethereal Mail service**. Whenever an authorized or unauthorized event occurs:
- The terminal prints a live preview link: `🔗 View Delivered Email: https://ethereal.email/message/...`
- The Web Dashboard ([http://localhost:3000](http://localhost:3000)) displays a clickable **"🔗 View Dispatched Email in Webmail Viewer ↗"** button.
- Anyone can click the link and view the exact rendered HTML email addressed to `pg016742@gmail.com` with full headers and security styling.

#### Mode B: Real Delivery to Your Actual Gmail Inbox (`pg016742@gmail.com`)
Because Google prevents unauthenticated third-party servers from injecting mail directly into personal `@gmail.com` accounts, real delivery requires an authenticated **Google App Password**:

1. **Enable 2-Step Verification:** Go to [Google Account Security](https://myaccount.google.com/security) and ensure **2-Step Verification** is turned ON.
2. **Generate an App Password:** Open **[https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)**.
3. **Name Your App:** In the app name box, enter **`IoThings Gate`** and click **Create**.
4. **Copy the 16-Letter Code:** Google will display a 16-character password (e.g. `abcd efgh ijkl mnop`).
5. **Configure [`.env`](file:///Users/pramod/Desktop/Modern_data_stores/.env):**
   ```env
   # Live Gmail SMTP Delivery
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=pg016742@gmail.com
   SMTP_PASS=your_16_letter_app_password
   DEFAULT_ALERT_EMAIL=pg016742@gmail.com
   ```
6. **Verify Delivery:** Run:
   ```bash
   npm run test:email
   ```
   Check your Gmail inbox (or Spam/Junk folder on first send) — the security alert arrives directly in your mailbox!

### 3. How to Send Unauthorized Sensor Data & Trigger Security Alert Emails

You can send unauthorized sensor data and verify urgent security alert emails across **6 convenient methods**:

#### Method 1: Instant CLI Command (`npm run sim:unauthorized`)
Run this single command anytime in your terminal:
```bash
# Simulates unauthorized person entering perimeter (Gate stays LOCKED, email sent to pg016742@gmail.com)
npm run sim:unauthorized

# Or test specific unauthorized sensor types:
node scripts/simulate_unauthorized.js --type rfid       # Unregistered RFID tag
node scripts/simulate_unauthorized.js --type alpr       # Unregistered vehicle plate
node scripts/simulate_unauthorized.js --type person     # Intruder detected in perimeter
node scripts/simulate_unauthorized.js --type tamper     # Control box accelerometer shock
```
**Terminal Output:**
```text
🚨 [IoThings] UNAUTHORIZED SENSOR DATA & SECURITY EMAIL ALERT INITIATED
✓ Status Code:      201
✓ Message:          Unauthorized sensor data recorded and security alert email dispatched to pg016742@gmail.com
✓ Event ID:         EVT-UNAUTH-1790612403730-793
✓ Event Type:       INTRUSION_DETECTED (CRITICAL)
✓ Identifier:       UNAUTHORIZED-PERSON-01
✓ Gate Status:      LOCKED (Lock Engaged: true)
✓ Denial Reason:    Unauthorized person entered property perimeter while gate is locked
✓ Security Email:   DISPATCHED TO pg016742@gmail.com
✓ Email Subject:    🚨 [IoThings Gate ALERT] Unauthorized Entry Attempt Detected at Main Gate! (UNAUTHORIZED-PERSON-01)
```

#### Method 2: Dedicated REST Endpoint (`POST /api/sensors/unauthorized`)
Hit this endpoint directly in Postman or via cURL:
```bash
curl -X POST http://localhost:3000/api/sensors/unauthorized \
  -H "Content-Type: application/json" \
  -d '{
    "type": "PERSON",
    "identifier": "UNAUTHORIZED-PERSON-88",
    "reason": "Unauthorized person entered property perimeter while gate is locked"
  }'
```

#### Method 3: Interactive Web Dashboard Controls & Web Audio Sound Ring
Open [http://localhost:3000](http://localhost:3000) in your browser:
1. In the **"Hardware Edge Simulator & Interactive Triggers"** panel, click:
   - **"🚷 Unauthorized Person"** — Rings the **urgent security siren**, slides down the red emergency alarm banner, keeps gate firmly locked, and dispatches the alert email to `pg016742@gmail.com`.
   - **"🚫 Unregistered RFID"** — Rings siren, locks solenoid deadbolt, and dispatches tag denial alert.
   - **"🛑 Unknown Vehicle"** — Rings siren, flashes gate lights, and dispatches plate rejection alert.
   - **"🚨 Enclosure Tamper Vibration (3.8G)"** — Dispatches critical physical breach alert with oscillating siren ring.
2. In the **"Automated Security & Access Email Notification Feed"** card, click:
   - **"🚨 Test Unauthorized Alert"** — Tests immediate direct email delivery to `pg016742@gmail.com`, sounding the siren ring and rendering the live webmail preview button.
   - **"🚨 Ring Alarm Siren"** — Manually test the browser Web Audio electronic siren ring.
   - **"🔔 Ring Access Chime"** — Test the pleasant 4-tone ascending resident entry chime.
   - **"✉ Test Authorized Email"** — Dispatches authorized resident entry confirmation and plays the chime.
3. Top Header Status Bar:
   - **`🔔 Siren Ring: ENABLED / MUTED`** — Click the sound status pill anytime to toggle audio on/off.
   - **`🔕 Silence Alarm Siren`** — Appears on the emergency banner during any intrusion event for instant operator silence.
   - **`🔗 View Dispatched Email in Webmail Viewer ↗`** — 1-click button to view the rendered HTML email in your browser.

#### Method 4: Automated Periodic Background Stream (Every 60s)
Configured in `.env`:
```env
TELEMETRY_INTERVAL_MS=15000
AUTO_UNAUTHORIZED_INTERVAL_CYCLES=4
```
While `npm start` is running, the background telemetry engine automatically emits an unauthorized sensor reading every 4th cycle (~60 seconds), recording the audit event, keeping the gate locked, and dispatching an email notification to `pg016742@gmail.com`.

#### Method 5: In the Postman Desktop App
In the official collection (`postman/IoThings_Smart_Gate.postman_collection.json`), select:
- **`03 - 3-Core Sensors & Telemetry`** -> **`POST Send Unauthorized Sensor Data (Intruder Alarm & Email Alert)`**
- Click **Send**. Both status `201 Created` and email dispatch assertions pass automatically.

#### Method 6: Policy Verification Rejection Endpoint
```bash
curl -X POST http://localhost:3000/api/policies/verify \
  -H "Content-Type: application/json" \
  -d '{"identifier": "CLONED-TAG-777", "method": "RFID_CONTACTLESS_SCAN"}'
```
**Response:**
```json
{"authorized": false, "reason": "Unregistered or inactive credential"}
```
*(Server automatically dispatches security alert email to `pg016742@gmail.com`).*

---

## 🔍 Real-Time API Hit & Request Monitoring

You can see, hit, and verify incoming API requests across **5 channels (including the Postman Desktop Application)**:

### 1. In the Postman Desktop Application (Official Collection with 33 Pre-Configured Requests)

The project includes an official Postman (v2.1.0) collection and environment configuration with **33 complete API requests**, pre-configured JSON payloads, query parameters, dynamic URL variables, and automated JavaScript assertions (`pm.test`):

- **Collection File:** [`postman/IoThings_Smart_Gate.postman_collection.json`](file:///Users/pramod/Desktop/Modern_data_stores/postman/IoThings_Smart_Gate.postman_collection.json) (or root [`postman_collection.json`](file:///Users/pramod/Desktop/Modern_data_stores/postman_collection.json))
- **Environment File:** [`postman/IoThings_Local.postman_environment.json`](file:///Users/pramod/Desktop/Modern_data_stores/postman/IoThings_Local.postman_environment.json) (or root [`postman_environment.json`](file:///Users/pramod/Desktop/Modern_data_stores/postman_environment.json))
- **Dedicated Step-by-Step Guide:** [`POSTMAN_GUIDE.md`](file:///Users/pramod/Desktop/Modern_data_stores/POSTMAN_GUIDE.md)

#### Quick 3-Step Import:
1. **Open Postman:** Launch Postman on macOS (`open -a Postman` or via Spotlight).
2. **Import Files:** Click **Import** (top-left, or `Cmd + O`) and drag-and-drop `postman_collection.json` and `postman_environment.json`.
3. **Select Environment:** In the top-right environment selector dropdown, choose **"IoThings Local Development (localhost:3000)"**.

---

### 📍 Where & How to Check API Hits in Postman (Client Side)

When you send any request in Postman (e.g. `POST /api/sensors/unauthorized` or `POST /api/policies`), you can inspect the API hit in **3 distinct locations**:

```mermaid
flowchart LR
    PostmanSend[Click 'Send' in Postman] --> RespPane[1. Response Bottom Pane: Status 200/201, Latency, JSON Body]
    PostmanSend --> TestTab[2. 'Test Results' Tab: Automated Assertions PASS]
    PostmanSend --> Console[3. Postman Console: Raw HTTP Headers & Payload]
    PostmanSend --> Terminal[4. Server Terminal: Live Log [HTTP API] ✓ ...]
```

#### A. In the Response Pane (Bottom Half of Postman)
Immediately after clicking **Send**:
1. **HTTP Status Badge:** Top-right of the response panel displays the status code:
   - `200 OK` (Green badge) for queries, updates, and commands.
   - `201 Created` (Green badge) for new credential registrations and unauthorized audit records.
2. **Response Latency & Size:** Displays the round-trip latency (e.g., `8 ms`) and payload size (e.g., `1.2 KB`), proving sub-10ms microsecond performance.
3. **Pretty-Printed JSON Body:** Displays the structured response:
   ```json
   {
     "success": true,
     "message": "Unauthorized intruder sensor event ingested successfully",
     "gateStatus": "LOCKED",
     "emailAlert": {
       "recipient": "pg016742@gmail.com",
       "previewUrl": "https://ethereal.email/message/..."
     }
   }
   ```

#### B. In the "Test Results" Tab
Click the **"Test Results"** tab next to Body/Headers in the response section:
- Shows green checkmarks for all automated assertions:
  - `✓ Status code is 201 Created`
  - `✓ Response contains success true`
  - `✓ Gate remains firmly LOCKED`
  - `✓ Dispatched email alert contains recipient pg016742@gmail.com`

#### C. In the Postman Console (`Alt + Cmd + C`)
To inspect the **raw network packets, request headers, and response payload**:
1. Click the **"Console"** button in the bottom-left footer bar of Postman (or press `Alt + Cmd + C` on macOS).
2. Click on the logged request line (e.g. `POST http://localhost:3000/api/sensors/unauthorized`).
3. You will see the complete breakdown:
   - **Request Headers:** `Content-Type: application/json`, `User-Agent: PostmanRuntime/7.x`
   - **Request Body:** Exact JSON sent to the server.
   - **Response Headers:** `X-Powered-By: Express`, `Access-Control-Allow-Origin: *`
   - **Response Body:** Full raw JSON returned by MongoDB and Express.

---

### 🖥️ 2. In the Server Terminal (Live Backend API Logger)

Whenever any request is made from Postman, the terminal running `npm start` prints real-time, color-coded diagnostic logs:

```text
[HTTP API] ✓ GET /health -> 200 (2ms)
[HTTP API] ✓ GET /api/gate/status -> 200 (0ms)
[HTTP API] ✓ POST /api/sensors/unauthorized -> 201 (14ms)
[HTTP API] ✓ POST /api/gate/command -> 200 (10ms)
[HTTP API] ✓ POST /api/policies -> 201 (12ms)
[HTTP API] ✓ GET /api/analytics/sensor-health -> 200 (11ms)
```

For security alerts or unauthorized events, the server terminal also outputs:
```text
🚨 [SECURITY ALERT EMAIL DISPATCHED]
  ├─ To:      pg016742@gmail.com
  ├─ Subject: 🚨 [IoThings Gate ALERT] Unauthorized Entry Attempt Detected at Main Gate! (UNKNOWN-CLONE-99)
  ├─ 🔗 View Delivered Email: https://ethereal.email/message/arqexAcJu4JvBTerarqf9vLvAxtdrDyCAAAABwrk8kNQJS-2vASgdAXMGxY
  └─ Details: Unauthorized attempt with RFID_TAG [UNKNOWN-CLONE-99] via RFID_CONTACTLESS_SCAN at 18:12:20

🚨 [UNAUTHORIZED SENSOR DATA] [10:57:20 PM] Type: RFID_ENTRY_DENIED | ID: UNKNOWN-CLONE-99 | Gate: LOCKED 🔒
  └─ Security Alert Email dispatched to: pg016742@gmail.com (Alert ID: NOTIF-ALERT-1790615542814-24)
```

> [!IMPORTANT]
> **Prerequisite:** Ensure the server is actively running with `npm start`. If you ran `npm run server:stop` earlier, start it with `npm start` in a separate terminal before sending requests in Postman.

---

### 3. In Browser Developer Tools (Network Tab)
1. Open [http://localhost:3000](http://localhost:3000) and press **`F12`** (or right-click -> **Inspect**).
2. Click the **Network** tab and select the **Fetch/XHR** filter.
3. Every button click (Open, Close, Add Credential, Test Email, Siren Ring) shows its HTTP status (`200 OK`), request body, and response JSON in real time.

### 4. In the Web UI Interactive Status Box
Beneath the Simulator buttons on the dashboard ([http://localhost:3000](http://localhost:3000)), the live feedback box displays the operational outcome:
- `✓ Command 'OPEN' accepted and published to MQTT!`
- `✓ Registered new RFID_TAG for Pramod (CRUD: CREATE)`
- `✓ Test email dispatched to pg016742@gmail.com!`
- `🚨 Unauthorized security alert email dispatched to pg016742@gmail.com!`

### 5. Direct Terminal CLI Verification (`curl -v`)
```bash
# Check gate status
curl -v http://localhost:3000/api/gate/status

# Verify credential and trigger entry email
curl -v -X POST http://localhost:3000/api/policies/verify \
  -H "Content-Type: application/json" \
  -d '{"identifier": "RFID-8842-A"}'

# Send unauthorized sensor data
curl -v -X POST http://localhost:3000/api/sensors/unauthorized \
  -H "Content-Type: application/json" \
  -d '{"type": "PERSON", "identifier": "UNAUTHORIZED-INTRUDER-99"}'
```

---

## 📊 Empirical Evaluation & Benchmarking

The system underwent empirical performance benchmarking on the **3-Node MongoDB Replica Set (`rs0`)** over **4,033 continuous 5-minute telemetry records**:

### CRUD Operations Latency
| CRUD Primitive | Target Operation | Mean Latency | Verification Status |
| :--- | :--- | :--- | :--- |
| **CREATE** | `AccessPolicy.save()` | **10.29 ms** | **PASSED** (HTTP 201 Created) |
| **READ** | `AccessPolicy.findOne()` | **2.03 ms** | **PASSED** (Indexed $O(1)$) |
| **UPDATE** | `AccessPolicy.updateOne()` | **10.71 ms** | **PASSED** (Modified in place) |
| **DELETE** | `AccessPolicy.deleteOne()` | **11.94 ms** | **PASSED** (Purged from cluster) |

### Distributed Write Concern Latency
- **Write Concern `{ w: 1 }` (Primary-Only Acknowledgment):** **5.45 ms**
- **Write Concern `{ w: "majority", j: true }` (Replicated & Journaled):** **9.23 ms**
- *Replication Delta:* Only **3.78 ms** overhead to guarantee majority consensus across 3 nodes.

### In-Database Aggregation Pipeline Execution
- **24-Hour Gate Traffic Heatmap Pipeline:** **6.44 ms**
- **Security Incident & Threat Multi-Facet Pipeline:** **2.19 ms**
- **Motor Health & Predictive Maintenance Pipeline:** **4.81 ms**
- **3-Core Sensor Health Analytics Pipeline:** **8.43 ms**
  - *Photocell Flux Average:* 93.0% (`HEALTHY`)
  - *Limit Switch Closed Confirmation Rate:* 97.2%
  - *RFID Noise Floor Average:* -83.3 dBm (100% Heartbeat)

---

## 📡 REST API & MQTT Topic Reference

### REST API Endpoints

| HTTP Method | Route | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Server and database health check |
| `POST` | `/api/gate/command` | Dispatch gate action (`OPEN`, `CLOSE`, `LOCK`, `UNLOCK`, `STOP`) |
| `GET` | `/api/gate/status` | Current physical state of gate, deadbolt, reed switch, and motor |
| `GET` | `/api/sensors/events` | Query audit events (`eventType`, `severity`, date range) |
| `POST` | `/api/sensors/event` | Ingest sensor event directly via REST API |
| `GET` | `/api/sensors/telemetry` | Query recent 5-minute time-series telemetry records |
| `POST` | `/api/sensors/generate-telemetry` | On-demand generation of a 5-minute telemetry sample |
| `POST` | `/api/policies` | **CRUD CREATE**: Register new access credential |
| `GET` | `/api/policies` | **CRUD READ**: List all access policies |
| `GET` | `/api/policies/:id` | **CRUD READ**: Retrieve single policy |
| `PUT` | `/api/policies/:id` | **CRUD UPDATE**: Update policy schedule or email |
| `DELETE` | `/api/policies/:id` | **CRUD DELETE**: Revoke credential |
| `POST` | `/api/policies/verify` | Verify credential and trigger entry notification |
| `GET` | `/api/notifications` | Query recent dispatched email notifications log |
| `POST` | `/api/notifications/test` | Trigger an authorized test email dispatch |
| `POST` | `/api/notifications/test-unauthorized` | Trigger an unauthorized intruder security alert email dispatch |
| `GET` | `/api/cluster/status` | MongoDB 3-Node Replica Set diagnostics |
| `GET` | `/api/analytics/hourly-traffic` | 24-hour peak traffic aggregation |
| `GET` | `/api/analytics/security` | Security incident aggregation |
| `GET` | `/api/analytics/motor-health` | Motor cycle and servicing predictive analytics |
| `GET` | `/api/analytics/sensor-health` | 3-Core sensor health aggregation |

### 📬 Testing APIs in the Postman Application

The project includes an official **Postman Collection (v2.1.0)** with **33 pre-configured requests** covering all routes, request bodies, query parameters, and automated test assertions.

- **Postman Collection File:** [`postman/IoThings_Smart_Gate.postman_collection.json`](file:///Users/pramod/Desktop/Modern_data_stores/postman/IoThings_Smart_Gate.postman_collection.json) (or root [`postman_collection.json`](file:///Users/pramod/Desktop/Modern_data_stores/postman_collection.json))
- **Postman Environment File:** [`postman/IoThings_Local.postman_environment.json`](file:///Users/pramod/Desktop/Modern_data_stores/postman/IoThings_Local.postman_environment.json) (or root [`postman_environment.json`](file:///Users/pramod/Desktop/Modern_data_stores/postman_environment.json))
- **Detailed Step-by-Step Postman Guide:** [`POSTMAN_GUIDE.md`](file:///Users/pramod/Desktop/Modern_data_stores/POSTMAN_GUIDE.md)

**Quick 3-Step Import into Postman:**
1. Open Postman (`open -a Postman` or from macOS Applications).
2. Click **Import** (top-left) and select `postman_collection.json` and `postman_environment.json`.
3. Select the environment **"IoThings Local Development (localhost:3000)"** in the top-right dropdown, and click **Send** on any request or run the entire collection with the Postman Collection Runner!


### MQTT Topic Hierarchy

| MQTT Topic | Direction | Payload Example | Purpose |
| :--- | :---: | :--- | :--- |
| `iothings/home/{id}/gate/telemetry` | Publish | `{"photocell": {...}, "limitSwitch": {...}, "rfidReader": {...}}` | Continuous 5-min sensor telemetry |
| `iothings/home/{id}/gate/events` | Publish | `{"eventType": "RFID_SCAN", "payload": {"tagId": "..."}}` | Access scans, beam interruptions, tamper alerts |
| `iothings/home/{id}/gate/status` | Publish | `{"status": "OPENING", "lockEngaged": false}` | Actuator state updates |
| `iothings/home/{id}/gate/commands` | Subscribe | `{"action": "OPEN", "reason": "Authorized RFID"}` | Commands dispatched to physical gate controller |

---

## 📁 Project Directory & File Structure

```text
Modern_data_stores/
├── .env                                # Environment configurations (MongoDB URI, MQTT port, Alert Email)
├── package.json                        # NPM scripts, dependencies, prestart port cleaners
├── README.md                           # Master architectural documentation and quickstart
├── backend/
│   ├── server.js                       # Express app, Aedes MQTT broker, API request logger
│   ├── config/
│   │   └── db.js                       # Mongoose connection with replica set retry & failover
│   ├── models/
│   │   ├── AccessPolicy.js             # Mongoose schema for credentials & notificationEmail
│   │   ├── GateEvent.js                # Schema for gate audits, scans, beam trips
│   │   ├── GateHardware.js             # Schema for 7 gate devices and specs
│   │   └── GateTelemetry.js            # Unified schema for Photocell, Limit Switch & RFID (TTL)
│   ├── mqtt/
│   │   ├── mqttBroker.js               # Embedded Aedes MQTT broker setup
│   │   └── mqttHandler.js              # MQTT subscriber, access verification, <8ms safety reversal
│   ├── routes/
│   │   ├── analyticsRoutes.js          # In-database MongoDB aggregation pipelines
│   │   ├── clusterRoutes.js            # 3-Node Replica Set diagnostic status endpoint
│   │   ├── gateRoutes.js               # Gate state and manual control endpoints
│   │   ├── notificationRoutes.js       # Live email notification logs and test dispatch
│   │   ├── policyRoutes.js             # Full CRUD endpoints for access policies
│   │   └── sensorRoutes.js             # Telemetry queries and event ingestion endpoints
│   └── services/
│       └── emailService.js             # Notification dispatcher (Gmail SMTP / Console receipt)
├── public/                             # Glassmorphic Web Dashboard
│   ├── index.html                      # HTML5 interface with SVG gate visualizer & email stream
│   ├── css/
│   │   └── styles.css                  # Custom responsive CSS design system
│   └── js/
│       └── app.js                      # Client JavaScript with Server-Sent Events (SSE)
├── scripts/
│   ├── start_replica_set.sh            # Script to spawn 3 local mongod daemons & initiate rs0
│   ├── stop_replica_set.sh             # Script to cleanly shut down the 3-node cluster
│   ├── seed_dataset.js                 # UK GDPR compliant 5,700+ document seeder
│   ├── continuous_sensor_generator.js  # Dedicated 5-minute telemetry generator & backfiller
│   └── benchmark_queries.js            # Empirical latency benchmark harness
├── simulator/
│   └── gate_simulator.js               # Hardware simulator for RFID scans, beam trips, obstacles
├── tests/
│   └── api.test.js                     # 14 automated integration & unit tests
├── docker/
│   └── docker-compose.yml              # Containerized multi-node MongoDB & app deployment
├── postman/
│   ├── IoThings_Smart_Gate.postman_collection.json # 33 pre-configured requests across 6 folders
│   ├── IoThings_Local.postman_environment.json     # Environment variables (baseUrl, IDs)
│   └── POSTMAN_GUIDE.md                            # Comprehensive step-by-step Postman testing guide
└── report/
    ├── IoThings_Main_Gate_Automation_Report.pdf   # ⭐ Moodle Submission Document (15-page publication PDF)
    ├── IoThings_Main_Gate_Automation_Report.html  # Print-ready Level 6 academic report (~4,150 words)
    ├── IoThings_Main_Gate_Automation_Report.md    # Markdown source of the academic report
    └── benchmark_results.json                     # Empirical benchmark metrics output
```

---

## 🐳 Docker Containerized Deployment

To launch the complete distributed stack (3 MongoDB nodes, replica set initiator, and application) via Docker Compose:

```bash
docker compose -f docker/docker-compose.yml up -d
```

---

## 🛠️ Troubleshooting & Common FAQs

### 1. `Error: listen EADDRINUSE: address already in use :::3000`
- **Cause:** A previous Node process was left running on port 3000.
- **Fix:** Running `npm start` automatically runs `prestart` which clears port 3000 and 1883. You can also manually run:
  ```bash
  npm run server:stop
  # Or directly:
  lsof -ti:3000,1883 -sTCP:LISTEN | xargs kill -9 2>/dev/null || true
  ```

### 2. `MongooseServerSelectionError: connect ECONNREFUSED 127.0.0.1:27017`
- **Cause:** The MongoDB 3-Node Replica Set is not currently running.
- **Fix:** Launch the cluster using the automated startup script:
  ```bash
  npm run cluster:start
  ```

### 3. How do I verify my email is receiving alerts?
- The recipient `pg016742@gmail.com` is configured as both the `DEFAULT_ALERT_EMAIL` in [`.env`](file:///Users/pramod/Desktop/Modern_data_stores/.env) and the `notificationEmail` for the resident policies.
- To test immediately, click **"✉ Send Test Email"** on the Web UI at [http://localhost:3000](http://localhost:3000) or run:
  ```bash
  curl -X POST http://localhost:3000/api/notifications/test
  ```

---

## 🎓 BCU Assessment Brief Compliance Matrix

| Assessment Brief Criterion | Module Learning Outcome | Implementation Location & Evidence |
| :--- | :---: | :--- |
| **NoSQL Types, Theories & Technologies** | **LO1 (20%)** | Rigorous academic appraisal of Document, Key-Value, Columnar, and Graph stores; CAP theorem (Gilbert & Lynch), Abadi's PACELC model, ACID vs BASE. ([Report PDF](file:///Users/pramod/Desktop/Modern_data_stores/report/IoThings_Main_Gate_Automation_Report.pdf), [Report HTML](file:///Users/pramod/Desktop/Modern_data_stores/report/IoThings_Main_Gate_Automation_Report.html) Sections 2 & 4) |
| **Critical Comparison: Relational vs NoSQL** | **LO2 (20%)** | 6-dimension comparative analysis: Schema-on-Write vs Dynamic Schema, 3NF vs Document Embedding (Data Locality), SQL vs MQL, Scalability, and Polyglot Persistence proving NoSQL extends SQL. ([Report PDF](file:///Users/pramod/Desktop/Modern_data_stores/report/IoThings_Main_Gate_Automation_Report.pdf), [Report HTML](file:///Users/pramod/Desktop/Modern_data_stores/report/IoThings_Main_Gate_Automation_Report.html) Sections 3 & 5) |
| **Distributed Data Management System** | **LO4 (20%)** | 3-Node MongoDB Replica Set (`rs0`) with quorum voting, Raft election failover, oplog replication, and write concerns (`w: 1` vs `w: majority`). ([Report PDF](file:///Users/pramod/Desktop/Modern_data_stores/report/IoThings_Main_Gate_Automation_Report.pdf), [start_replica_set.sh](file:///Users/pramod/Desktop/Modern_data_stores/scripts/start_replica_set.sh)) |
| **SME Domain & Sensors Activation Store** | **Core Scenario** | IoThings Home Automation Solutions (UK SME) house main gate: Photocell, Limit Switch, RFID Reader with continuous 5-minute sampling intervals and 30-day TTL index. ([GateTelemetry.js](file:///Users/pramod/Desktop/Modern_data_stores/backend/models/GateTelemetry.js), [continuous_sensor_generator.js](file:///Users/pramod/Desktop/Modern_data_stores/scripts/continuous_sensor_generator.js)) |
| **Node.js & MQTT Broker Integration** | **Technical Stack** | Asynchronous Node.js Express server (`:3000`) with embedded Aedes MQTT broker (`:1883`) handling `iothings/home/{homeId}/gate/#` with sub-second safety reversal (< 8ms). ([mqttHandler.js](file:///Users/pramod/Desktop/Modern_data_stores/backend/mqtt/mqttHandler.js)) |
| **Full CRUD Provision & Verification** | **Core Mandate** | Full Create, Read, Update, Delete provision on access policies with automated evaluation test harness passing 14/14 test suites and Postman automated assertions. ([api.test.js](file:///Users/pramod/Desktop/Modern_data_stores/tests/api.test.js), [postman_collection.json](file:///Users/pramod/Desktop/Modern_data_stores/postman_collection.json)) |
| **UK GDPR Synthetic Dataset** | **Data Governance** | 5,800+ synthetic documents (1,800+ events, 4,033 continuous 5-minute telemetry records over 14 days, 7 devices, 6 policies) generated without privacy violations. ([seed_dataset.js](file:///Users/pramod/Desktop/Modern_data_stores/scripts/seed_dataset.js)) |
| **Academic Report Standards** | **Presentation** | ~4,150 words, Font size 11pt, 1.5 line spacing, structured coversheet (Candidate: Pramod, Submission: May 2025), and 20+ Harvard references in PDF format. ([Report PDF](file:///Users/pramod/Desktop/Modern_data_stores/report/IoThings_Main_Gate_Automation_Report.pdf)) |

---

## 📄 Academic Coursework Deliverables

The complete academic consultancy report designed strictly for Birmingham City University (CMP6207) is available in three formats:

1. **⭐ Moodle Submission Document (Publication-Ready PDF):**
   [`report/IoThings_Main_Gate_Automation_Report.pdf`](file:///Users/pramod/Desktop/Modern_data_stores/report/IoThings_Main_Gate_Automation_Report.pdf)
   - **Primary Deliverable:** Formatted strictly to BCU submission guidelines: Font size 11pt, 1.5 line spacing, standard margins, structured coversheet, table of contents, ~4,150 words, and 20+ peer-reviewed Harvard references. Ready for immediate upload to Moodle.
   - *To re-compile anytime:* `npm run report:pdf`

2. **Print-Ready Formatted HTML Source:**
   [`report/IoThings_Main_Gate_Automation_Report.html`](file:///Users/pramod/Desktop/Modern_data_stores/report/IoThings_Main_Gate_Automation_Report.html)

3. **Comprehensive Markdown Report Source:**
   [`report/IoThings_Main_Gate_Automation_Report.md`](file:///Users/pramod/Desktop/Modern_data_stores/report/IoThings_Main_Gate_Automation_Report.md)

4. **Empirical Benchmark Metrics JSON:**
   [`report/benchmark_results.json`](file:///Users/pramod/Desktop/Modern_data_stores/report/benchmark_results.json)
   - Contains live measured execution latencies for CRUD operations, write concerns (`w: 1` vs `w: majority`), and aggregation pipelines.
   - *To re-benchmark anytime:* `npm run benchmark`

