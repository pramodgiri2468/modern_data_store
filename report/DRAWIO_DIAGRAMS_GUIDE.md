# Draw.io Diagrams Guide for IoThings Main Gate Automation Report

This guide provides step-by-step specifications for creating the 5 core figures in [draw.io](https://app.diagrams.net/) for the CMP6207 Academic Consultancy Report. 

Once created in draw.io, export each diagram as **PNG** (or **PDF**) with **transparent background** (or white background) at **300 DPI (2x zoom)**, and save them in the `report/figures/` folder with the filenames listed below.

---

## Color Palette Reference (Modern Professional Theme)
Use these consistent hex codes across your draw.io diagrams:
- **Primary Blue (Sensors & Devices):** `#2B6CB0` (Fill: `#EBF8FF`, Stroke: `#2B6CB0`)
- **Teal / Cyan (MQTT & Ingestion):** `#319795` (Fill: `#E6FFFA`, Stroke: `#319795`)
- **Purple (Node.js & Backend Services):** `#6B46C1` (Fill: `#FAF5FF`, Stroke: `#6B46C1`)
- **Green (MongoDB Primary / Quorum):** `#2F855A` (Fill: `#F0FFF4`, Stroke: `#2F855A`)
- **Amber / Orange (MongoDB Secondaries / Storage):** `#DD6B20` (Fill: `#FFFAF0`, Stroke: `#DD6B20`)
- **Red / Crimson (Safety Trigger / Alerts):** `#C53030` (Fill: `#FFF5F5`, Stroke: `#C53030`)
- **Neutral Dark (Text & Connectors):** `#2D3748`

---

## Figure 1: End-to-End System Architecture
- **Filename:** `report/figures/fig1_system_architecture.png`
- **LaTeX Reference:** `\label{fig:system_architecture}`
- **Dimensions:** ~800 × 450 px

### Layout & Components:
```
+---------------------------------------------------------------------------------------------------------+
|                                    END-TO-END SYSTEM ARCHITECTURE                                       |
+---------------------------------------------------------------------------------------------------------+
| [Layer 1: Perception (Gate Sensors)]                                                                    |
|   +-----------------------+   +-----------------------+   +-----------------------+                     |
|   | 1. Optical Photocell  |   | 2. Limit Switch       |   | 3. RFID Reader        |                     |
|   | Infrared Safety Beam  |   | CLOSED / OPEN / AJAR  |   | 13.56 MHz Badges      |                     |
|   | Pin: D4 (GPIO)        |   | Pin: D7 (GPIO)        |   | Wiegand-26 Protocol   |                     |
|   +-----------+-----------+   +-----------+-----------+   +-----------+-----------+                     |
|               |                           |                           |                                 |
|               +---------------------------+---------------------------+                                 |
|                                           | MQTT Publish (QoS 1)                                        |
|                                           v Topic: iothings/home/{id}/gate/#                            |
| [Layer 2: Transport & Ingestion]                                                                        |
|   +-----------------------------------------------------------------------+                             |
|   |                      Embedded Aedes MQTT Broker                       |                             |
|   |                      Port: 1883 | TCP Keep-Alive: 60s                 |                             |
|   +-----------------------------------+-----------------------------------+                             |
|                                       | Internal Event Bus                                              |
|                                       v                                                                 |
| [Layer 3: Processing & Safety Logic]                                                                    |
|   +-----------------------------------------------------------------------+                             |
|   |                   Node.js Express Controller Server                   |                             |
|   |                   Port: 3000 | Safety Interlock (<8ms)                |                             |
|   +-------------------+-----------------------------------+---------------+                             |
|                       |                                   |                                             |
|        Mongoose Driver| {w: "majority", j: true}          | HTTPS / WebSockets                          |
|                       v                                   v                                             |
| [Layer 4: Distributed Persistence]             [Layer 5: Presentation & Alerts]                         |
|   +-----------------------------------+          +-----------------------------------+                  |
|   |     MongoDB Replica Set (rs0)     |          |       Real-Time Dashboard         |                  |
|   |   Primary :27017 (R/W)            |          |       Port 3000 Web UI            |                  |
|   |   Secondary :27018 | Sec :27019   |          +-----------------------------------+                  |
|   +-----------------------------------+          |      Security Email Alerts        |                  |
|                                                  |   Nodemailer -> pg016742@gmail.com|                  |
|                                                  +-----------------------------------+                  |
+---------------------------------------------------------------------------------------------------------+
```

### Step-by-Step in Draw.io:
1. Drag 5 large horizontal container swimlanes or rectangles for the 5 layers.
2. In **Layer 1**, place 3 rounded rectangles for the sensors (Blue outline).
3. Connect all 3 to an arrow pointing down to **Layer 2** (Teal box labeled "Embedded Aedes MQTT Broker :1883").
4. Draw an arrow pointing down to **Layer 3** (Purple box labeled "Node.js Express Controller Server :3000").
5. Branch two arrows from Layer 3:
   - One pointing to **Layer 4** (Green container labeled "MongoDB Replica Set (rs0)").
   - One pointing to **Layer 5** (Red/Purple boxes for "Web Dashboard" and "Security Alert Mailer").

---

## Figure 2: 3-Node MongoDB Replica Set Architecture & Quorum Consensus
- **Filename:** `report/figures/fig2_replica_set_topology.png`
- **LaTeX Reference:** `\label{fig:replica_set}`
- **Dimensions:** ~750 × 420 px

### Layout & Components:
```
+---------------------------------------------------------------------------------------------------------+
|                               3-NODE REPLICA SET TOPOLOGY & CONSENSUS (rs0)                             |
+---------------------------------------------------------------------------------------------------------+
|                                                                                                         |
|                            +-----------------------------------------------+                            |
|                            |               NODE 1: PRIMARY                 |                            |
|                            |               Port: 27017 (Vote: 1)           |                            |
|                            |      - Accepts Client Writes (w: "majority")  |                            |
|                            |      - Appends Writes to local.oplog.rs       |                            |
|                            |      - Sends 2-second Heartbeat Pings         |                            |
|                            +--------+-----------------------------+--------+                            |
|                                     |                             |                                     |
|             Asynchronous Oplog Sync |                             | Asynchronous Oplog Sync             |
|             & Bi-directional Pings  |                             | & Bi-directional Pings              |
|                                     v                             v                                     |
|             +-------------------------------+     +-------------------------------+                     |
|             |       NODE 2: SECONDARY       |     |       NODE 3: SECONDARY       |                     |
|             |       Port: 27018 (Vote: 1)   |     |       Port: 27019 (Vote: 1)   |                     |
|             |  - Replicates local.oplog.rs  |     |  - Replicates local.oplog.rs  |                     |
|             |  - Read Preference: secondary |     |  - Read Preference: secondary |                     |
|             |  - Quorum Voter               |     |  - Quorum Voter               |                     |
|             +---------------+---------------+     +---------------+---------------+                     |
|                             ^                                     ^                                     |
|                             |        Heartbeat Gossip (2000ms)    |                                     |
|                             +-------------------------------------+                                     |
|                                                                                                         |
|   ===================================================================================================   |
|   QUORUM CONSENSUS RULE:                                                                                |
|   Total Members (N) = 3  |  Required Votes (Q) = floor(N/2) + 1 = 2                                     |
|   If Node 1 fails -> Node 2 & 3 elect new Primary in <= 2.0s without split-brain partitioning.          |
+---------------------------------------------------------------------------------------------------------+
```

### Step-by-Step in Draw.io:
1. Place a triangle arrangement of 3 database cylinder or server shapes.
2. Top node: Label `Node 1: PRIMARY (Port 27017)`, Fill: Light Green `#F0FFF4`, Border: Dark Green `#2F855A`.
3. Bottom-left node: Label `Node 2: SECONDARY (Port 27018)`, Fill: Light Amber `#FFFAF0`, Border: Dark Orange `#DD6B20`.
4. Bottom-right node: Label `Node 3: SECONDARY (Port 27019)`, Fill: Light Amber `#FFFAF0`, Border: Dark Orange `#DD6B20`.
5. Connect them with double-ended dashed arrows for **Heartbeats (2s interval)**.
6. Connect Node 1 to Node 2 and Node 3 with thick solid arrows labeled **Oplog Replication Stream (`local.oplog.rs`)**.
7. Add a bottom callout banner with the Quorum formula: `Quorum = floor(N/2) + 1 = 2 of 3 votes`.

---

## Figure 3: Smart Gate State Machine & Obstacle Auto-Reverse Logic
- **Filename:** `report/figures/fig3_state_machine.png`
- **LaTeX Reference:** `\label{fig:state_machine}`
- **Dimensions:** ~750 × 380 px

### Layout & Components:
```
+---------------------------------------------------------------------------------------------------------+
|                               SMART GATE FINITE STATE MACHINE (FSM)                                     |
+---------------------------------------------------------------------------------------------------------+
|                                                                                                         |
|       +-------------------+         Valid RFID Scan         +-------------------+                       |
|       |                   | ------------------------------> |                   |                       |
|       |   FULLY_CLOSED    |                                 |      OPENING      |                       |
|       |   (Limit Switch)  | <------------------------------ |   (Motor Moving)  |                       |
|       +-------------------+          Manual Close           +---------+---------+                       |
|                 ^                                                     |                                 |
|                 |                                                     | Reaches Open Limit              |
|                 |                                                     v                                 |
|       +---------+---------+                                 +---------+---------+                       |
|       |                   |       No Obstacle & 15s Timer   |                   |                       |
|       |      CLOSING      | <------------------------------ |    FULLY_OPEN     |                       |
|       |   (Motor Moving)  |                                 |   (15s Dwell)     |                       |
|       +---------+---------+                                 +-------------------+                       |
|                 |                                                     ^                                 |
|                 |  OPTICAL PHOTOCELL BEAM BLOCKED (<8ms)              |                                 |
|                 |  (Pedestrian / Vehicle Obstacle Detected)           |                                 |
|                 +-----------------------------------------------------+                                 |
|                                EMERGENCY AUTO-REVERSE                                                   |
+---------------------------------------------------------------------------------------------------------+
```

### Step-by-Step in Draw.io:
1. Place 4 rounded rectangle states: `FULLY_CLOSED`, `OPENING`, `FULLY_OPEN`, `CLOSING`.
2. Connect `FULLY_CLOSED` to `OPENING` with arrow labeled `Valid RFID Badge / App Command`.
3. Connect `OPENING` to `FULLY_OPEN` with arrow labeled `Limit Switch: FULLY_OPEN`.
4. Connect `FULLY_OPEN` to `CLOSING` with arrow labeled `15-Second Inactivity Timeout`.
5. Connect `CLOSING` to `FULLY_CLOSED` with arrow labeled `Limit Switch: FULLY_CLOSED`.
6. **Key Safety Trigger:** Add a thick crimson red arrow from `CLOSING` directly reversing back to `OPENING` / `FULLY_OPEN`, labeled in bold red: `SAFETY INTERRUPT: Photocell Beam BLOCKED -> Immediate Auto-Reverse (<8ms)`.

---

## Figure 4: Relational Normalization (3NF) vs. MongoDB Document Model
- **Filename:** `report/figures/fig4_data_model_comparison.png`
- **LaTeX Reference:** `\label{fig:data_model}`
- **Dimensions:** ~800 × 420 px

### Layout & Components:
```
+---------------------------------------------------------------------------------------------------------+
|                 RELATIONAL 3NF SCHEMA vs. MONGODB EMBEDDED DOCUMENT MODEL                               |
+---------------------------------------------------------------------------------------------------------+
| [RELATIONAL (POSTGRESQL 3NF) - MULTI-TABLE JOINS]                                                       |
|                                                                                                         |
|   +-----------------------+              +-----------------------+                                      |
|   | gate_homes            | 1          * | gate_devices          |                                      |
|   |-----------------------| ------------ |-----------------------|                                      |
|   | PK  home_id           |              | PK  device_id         |                                      |
|   |     address_postcode  |              | FK  home_id           |                                      |
|   +-----------------------+              |     sensor_type       |                                      |
|                                          +-----------+-----------+                                      |
|                                                      | 1                                                |
|                                                      |                                                  |
|                                                      | *                                                |
|                                          +-----------v-----------+                                      |
|                                          | gate_telemetry_events |                                      |
|                                          |-----------------------|                                      |
|                                          | PK  event_id          |                                      |
|                                          | FK  device_id         | (Requires multi-table JOINs;         |
|                                          |     timestamp         |  high CPU & memory amplification)    |
|                                          |     metric_name       |                                      |
|                                          |     metric_value      |                                      |
|                                          +-----------------------+                                      |
|                                                                                                         |
| ------------------------------------------------------------------------------------------------------- |
| [MONGODB DOCUMENT MODEL - EMBEDDED PRE-AGGREGATION & DATA LOCALITY]                                     |
|                                                                                                         |
|   +-------------------------------------------------------------------------------------------------+   |
|   | {                                                                                               |   |
|   |   "_id": ObjectId("6709a1f2b4..."),                                                             |   |
|   |   "homeId": "HOME_UK_001",                                                                      |   |
|   |   "timestamp": ISODate("2026-10-02T08:14:22.100Z"),                                             |   |
|   |   "gateState": "CLOSING",                                                                       |   |
|   |   "sensors": {                                                                                  |   |
|   |     "photocell": { "status": "BLOCKED", "safetyTriggered": true },                              |   |
|   |     "limitSwitch": { "state": "AJAR", "angleDegrees": 42.5 },                                   |   |
|   |     "rfid": { "lastScannedTag": "TAG_AUTH_8831", "authorized": true }                           |   |
|   |   },                                                                                            |   |
|   |   "metrics": { "motorCurrentAmps": 3.82, "batteryVoltage": 13.6 }                               |   |
|   | }                                                                                               |   |
|   +-------------------------------------------------------------------------------------------------+   |
|   (Zero JOINs | Single atomic BSON disk read | Sub-millisecond latency | Dynamic schema polymorphism)   |
+---------------------------------------------------------------------------------------------------------+
```

### Step-by-Step in Draw.io:
1. Divide canvas into Left (or Top) and Right (or Bottom).
2. For Relational: Draw 3 database table entities (`gate_homes`, `gate_devices`, `gate_telemetry_events`) connected by Foreign Key 1-to-many relationship lines.
3. For MongoDB: Draw a large code-block container or JSON document shape with neat syntax highlighting showing embedded `sensors` and `metrics`.
4. Add a comparison banner highlighting: **Zero Joins vs. Multi-table Joins**, **Single Disk Read vs. Fragmented Seeks**.

---

## Figure 5: Write Concern Durability vs. Latency Benchmark
- **Filename:** `report/figures/fig5_benchmark_latency.png`
- **LaTeX Reference:** `\label{fig:benchmark_chart}`
- **Dimensions:** ~700 × 360 px

### Layout & Components:
```
+---------------------------------------------------------------------------------------------------------+
|                          EMPIRICAL WRITE CONCERN & CRUD LATENCY (MILLISECONDS)                          |
+---------------------------------------------------------------------------------------------------------+
|                                                                                                         |
|   14 ms |                                            [12.61 ms]             [12.92 ms]                  |
|   12 ms |                                              +----+                 +----+                    |
|   10 ms |                         [10.72 ms]           |    |                 |    |                    |
|    8 ms |                           +----+             |    |      [8.71 ms]  |    |                    |
|    6 ms |                           |    |             |    |        +----+   |    |                    |
|    4 ms |                           |    |  [2.75 ms]  |    |        |    |   |    |                    |
|    2 ms |  [1.30 ms]                |    |    +----+   |    |        |    |   |    |                    |
|    0 ms +----+----------------------+----+----+----+---+----+--------+----+---+----+-----------------   |
|             w:1                 Create     Read    w:majority        Update   Delete                    |
|        (Memory Acknowledge)   <------- CRUD Operations ------->    (Majority Journaled)                 |
|                                                                                                         |
|   ===================================================================================================   |
|   Takeaway: w: "majority" requires 12.61 ms (+11.31 ms network quorum overhead) ensuring ZERO data loss|
|   Read operations complete in 2.75 ms via compound index { homeId: 1, timestamp: -1 }.                 |
+---------------------------------------------------------------------------------------------------------+
```

### Step-by-Step in Draw.io:
1. Drag a Bar Chart shape or draw 6 vertical colored rectangle bars:
   - Bar 1: `w: 1 (Write Concern)` -> Value: `1.30 ms` (Cyan)
   - Bar 2: `Create Document` -> Value: `10.72 ms` (Blue)
   - Bar 3: `Indexed Read` -> Value: `2.75 ms` (Green)
   - Bar 4: `w: "majority" (Durability)` -> Value: `12.61 ms` (Orange)
   - Bar 5: `Update Operation` -> Value: `8.71 ms` (Purple)
   - Bar 6: `Delete Operation` -> Value: `12.92 ms` (Red)
2. Add horizontal dashed gridlines for 2, 4, 6, 8, 10, 12, 14 ms.
3. Label axes clearly: Y-Axis = `Latency (Milliseconds)`, X-Axis = `Operation Type`.

---

## How to Compile in LaTeX
1. Create the `report/figures/` directory.
2. In draw.io, go to **File -> Export as -> PNG** (or PDF). Ensure "Transparent Background" or "White" is checked, scale = 200%.
3. Name the files:
   - `fig1_system_architecture.png`
   - `fig2_replica_set_topology.png`
   - `fig3_state_machine.png`
   - `fig4_data_model_comparison.png`
   - `fig5_benchmark_latency.png`
4. The LaTeX template (`report/IoThings_Main_Gate_Automation_Report.tex`) includes an automated conditional block: if any image is missing, it will automatically render a neat, structured architectural placeholder box without causing any LaTeX build errors!
