const fs = require('fs');
const path = require('path');

const collection = {
  info: {
    _postman_id: "a72d9b64-59e1-4c12-9c71-f9254b0fa138",
    name: "IoThings Smart Gate Controller API (UK Assessment 2024-25)",
    description: "Complete, production-grade Postman collection for the IoThings Smart House Main Gate Automation Controller. Covers MongoDB 3-Node Replica Set diagnostics, Physical Gate actuation commands, 3-Core Sensor telemetry & 5-minute sampling, Access Control Policy CRUD, Real-Time Email Notifications (Resident Entry & Intruder Alerts), and Predictive Aggregation Analytics.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  variable: [
    {
      key: "baseUrl",
      value: "http://localhost:3000",
      type: "string",
      description: "Base URL of the Express API server"
    },
    {
      key: "homeId",
      value: "home_uk_01",
      type: "string",
      description: "Default UK Smart Home ID"
    },
    {
      key: "gateId",
      value: "gate_main_01",
      type: "string",
      description: "Default Main Gate Controller ID"
    },
    {
      key: "createdPolicyId",
      value: "",
      type: "string",
      description: "Dynamically populated by POST /api/policies test script"
    },
    {
      key: "createdPolicyIdentifier",
      value: "RFID-POSTMAN-8842",
      type: "string",
      description: "Test RFID credential identifier"
    }
  ],
  item: [
    {
      name: "01 - System Health & Cluster Diagnostics",
      description: "Endpoints for infrastructure monitoring, service heartbeat, and MongoDB 3-Node Replica Set (rs0) distributed consensus diagnostics.",
      item: [
        {
          name: "GET System Health Check",
          request: {
            method: "GET",
            header: [{ key: "Accept", value: "application/json" }],
            url: {
              raw: "{{baseUrl}}/health",
              host: ["{{baseUrl}}"],
              path: ["health"]
            },
            description: "Heartbeat check for the core backend HTTP server and embedded MQTT broker."
          },
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test(\"Status code is 200 OK\", function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test(\"System status is OK\", function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.status).to.eql(\"OK\");",
                  "});",
                  "pm.test(\"Response time is under 500ms\", function () {",
                  "    pm.expect(pm.response.responseTime).to.be.below(500);",
                  "});"
                ],
                type: "text/javascript"
              }
            }
          ]
        },
        {
          name: "GET Cluster Diagnostics (MongoDB 3-Node Replica Set rs0)",
          request: {
            method: "GET",
            header: [{ key: "Accept", value: "application/json" }],
            url: {
              raw: "{{baseUrl}}/api/cluster/status",
              host: ["{{baseUrl}}"],
              path: ["api", "cluster", "status"]
            },
            description: "Returns live state of MongoDB 3-Node Replica Set (rs0), identifying the active Primary node (port 27017) and Secondary nodes (ports 27018, 27019), replication optime lag, heartbeats, and cluster health."
          },
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test(\"Status code is 200 OK\", function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test(\"Cluster is ONLINE with rs0 replica set\", function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.success).to.be.true;",
                  "    pm.expect(json.data.status).to.eql(\"ONLINE\");",
                  "    pm.expect(json.data.replicaSet).to.eql(\"rs0\");",
                  "    pm.expect(json.data.members.length).to.be.at.least(1);",
                  "});"
                ],
                type: "text/javascript"
              }
            }
          ]
        }
      ]
    },
    {
      name: "02 - Main Gate Hardware Commands & Physical Status",
      description: "Dispatches physical gate actuation commands (OPEN, CLOSE, LOCK, UNLOCK, STOP, SAFETY_REVERSE) via MQTT and queries the simulated gate hardware telemetry state.",
      item: [
        {
          name: "GET Live Gate Physical State",
          request: {
            method: "GET",
            header: [{ key: "Accept", value: "application/json" }],
            url: {
              raw: "{{baseUrl}}/api/gate/status",
              host: ["{{baseUrl}}"],
              path: ["api", "gate", "status"]
            },
            description: "Queries real-time hardware status: gate position (IDLE_CLOSED, OPENING, OPEN, CLOSING), deadbolt lock engagement, magnetic reed switch state, optical beam continuity, and motor current."
          },
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test(\"Status code is 200 OK\", function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test(\"Gate state payload has core sensors\", function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.success).to.be.true;",
                  "    pm.expect(json.data).to.have.property('status');",
                  "    pm.expect(json.data).to.have.property('lockEngaged');",
                  "    pm.expect(json.data).to.have.property('photocell');",
                  "    pm.expect(json.data).to.have.property('limitSwitch');",
                  "    pm.expect(json.data).to.have.property('rfidReader');",
                  "});"
                ],
                type: "text/javascript"
              }
            }
          ]
        },
        {
          name: "POST Command - OPEN Gate",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                action: "OPEN",
                homeId: "{{homeId}}",
                gateId: "{{gateId}}",
                reason: "Authorized Resident Opening via Postman"
              }, null, 2)
            },
            url: {
              raw: "{{baseUrl}}/api/gate/command",
              host: ["{{baseUrl}}"],
              path: ["api", "gate", "command"]
            },
            description: "Publishes an 'OPEN' command to MQTT broker topic `iothings/home/home_uk_01/gate/commands` and records a MANUAL_REMOTE_OPEN event in MongoDB."
          },
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test(\"Status code is 200 OK\", function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test(\"Command published via MQTT\", function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.success).to.be.true;",
                  "    pm.expect(json.action).to.eql(\"OPEN\");",
                  "    pm.expect(json.mqttPublished).to.be.true;",
                  "});"
                ],
                type: "text/javascript"
              }
            }
          ]
        },
        {
          name: "POST Command - CLOSE Gate",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                action: "CLOSE",
                homeId: "{{homeId}}",
                gateId: "{{gateId}}",
                reason: "Scheduled Auto-Close via Postman"
              }, null, 2)
            },
            url: {
              raw: "{{baseUrl}}/api/gate/command",
              host: ["{{baseUrl}}"],
              path: ["api", "gate", "command"]
            },
            description: "Publishes a 'CLOSE' command to MQTT broker topic `iothings/home/home_uk_01/gate/commands`."
          },
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test(\"Status code is 200 OK\", function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test(\"Command published via MQTT\", function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.success).to.be.true;",
                  "    pm.expect(json.action).to.eql(\"CLOSE\");",
                  "});"
                ],
                type: "text/javascript"
              }
            }
          ]
        },
        {
          name: "POST Command - UNLOCK Deadbolt",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                action: "UNLOCK",
                homeId: "{{homeId}}",
                gateId: "{{gateId}}",
                reason: "Manual Remote Unlock via Postman"
              }, null, 2)
            },
            url: {
              raw: "{{baseUrl}}/api/gate/command",
              host: ["{{baseUrl}}"],
              path: ["api", "gate", "command"]
            },
            description: "Retracts heavy-duty electromagnetic deadbolt solenoid."
          },
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test(\"Status code is 200 OK\", function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test(\"Lock released\", function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.success).to.be.true;",
                  "    pm.expect(json.action).to.eql(\"UNLOCK\");",
                  "});"
                ],
                type: "text/javascript"
              }
            }
          ]
        },
        {
          name: "POST Command - LOCK Deadbolt",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                action: "LOCK",
                homeId: "{{homeId}}",
                gateId: "{{gateId}}",
                reason: "Perimeter Security Night Lockdown via Postman"
              }, null, 2)
            },
            url: {
              raw: "{{baseUrl}}/api/gate/command",
              host: ["{{baseUrl}}"],
              path: ["api", "gate", "command"]
            },
            description: "Engages solenoid deadbolt lock."
          },
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test(\"Status code is 200 OK\", function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test(\"Lock engaged\", function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.success).to.be.true;",
                  "    pm.expect(json.action).to.eql(\"LOCK\");",
                  "});"
                ],
                type: "text/javascript"
              }
            }
          ]
        },
        {
          name: "POST Command - EMERGENCY STOP",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                action: "STOP",
                homeId: "{{homeId}}",
                gateId: "{{gateId}}",
                reason: "Emergency Operator E-Stop Triggered"
              }, null, 2)
            },
            url: {
              raw: "{{baseUrl}}/api/gate/command",
              host: ["{{baseUrl}}"],
              path: ["api", "gate", "command"]
            },
            description: "Instant sub-second motor brake disengagement. Stops gate in its current travel position immediately."
          },
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test(\"Status code is 200 OK\", function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test(\"Emergency stop published\", function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.success).to.be.true;",
                  "    pm.expect(json.action).to.eql(\"STOP\");",
                  "});"
                ],
                type: "text/javascript"
              }
            }
          ]
        },
        {
          name: "POST Command - SAFETY REVERSE",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                action: "SAFETY_REVERSE",
                homeId: "{{homeId}}",
                gateId: "{{gateId}}",
                reason: "Infrared Optical Beam Obstacle Triggered"
              }, null, 2)
            },
            url: {
              raw: "{{baseUrl}}/api/gate/command",
              host: ["{{baseUrl}}"],
              path: ["api", "gate", "command"]
            },
            description: "Safety reversal triggered when photocell optical beam detects an obstacle during closure."
          },
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test(\"Status code is 200 OK\", function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test(\"Safety reverse action published\", function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.success).to.be.true;",
                  "    pm.expect(json.action).to.eql(\"SAFETY_REVERSE\");",
                  "});"
                ],
                type: "text/javascript"
              }
            }
          ]
        }
      ]
    },
    {
      name: "03 - 3-Core Sensors & Telemetry (Continuous 5-Min Intervals)",
      description: "Sensor events ingestion, continuous 5-minute time-series telemetry generation, and interactive hardware simulator triggers.",
      item: [
        {
          name: "GET Filtered Audit & Security Events",
          request: {
            method: "GET",
            header: [{ key: "Accept", value: "application/json" }],
            url: {
              raw: "{{baseUrl}}/api/sensors/events?homeId={{homeId}}&limit=20",
              host: ["{{baseUrl}}"],
              path: ["api", "sensors", "events"],
              query: [
                { key: "homeId", value: "{{homeId}}" },
                { key: "limit", value: "20" },
                { key: "severity", value: "INFO", disabled: true },
                { key: "eventType", value: "RFID_SCAN", disabled: true }
              ]
            },
            description: "Fetches security audit events from MongoDB with support for pagination, severity filtering (INFO, WARN, CRITICAL), and timestamp range."
          },
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test(\"Status code is 200 OK\", function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test(\"Events array returned with metadata\", function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.success).to.be.true;",
                  "    pm.expect(json).to.have.property('total');",
                  "    pm.expect(Array.isArray(json.data)).to.be.true;",
                  "});"
                ],
                type: "text/javascript"
              }
            }
          ]
        },
        {
          name: "POST Ingest Sensor Event (REST API Ingestion)",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                homeId: "{{homeId}}",
                gateId: "{{gateId}}",
                eventType: "MANUAL_REMOTE_OPEN",
                severity: "INFO",
                sensorId: "sensor_postman_client",
                source: "REST_API_POSTMAN",
                payload: {
                  operator: "Postman QA Tester",
                  deviceType: "HTTP_CLIENT",
                  location: "Gate Pillar External"
                }
              }, null, 2)
            },
            url: {
              raw: "{{baseUrl}}/api/sensors/event",
              host: ["{{baseUrl}}"],
              path: ["api", "sensors", "event"]
            },
            description: "Directly ingests a hardware sensor event into MongoDB via REST endpoint."
          },
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test(\"Status code is 201 Created\", function () {",
                  "    pm.response.to.have.status(201);",
                  "});",
                  "pm.test(\"Event recorded successfully\", function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.success).to.be.true;",
                  "    pm.expect(json.data).to.have.property('eventId');",
                  "});"
                ],
                type: "text/javascript"
              }
            }
          ]
        },
        {
          name: "GET 5-Minute Time-Series Telemetry",
          request: {
            method: "GET",
            header: [{ key: "Accept", value: "application/json" }],
            url: {
              raw: "{{baseUrl}}/api/sensors/telemetry?gateId={{gateId}}&limit=30",
              host: ["{{baseUrl}}"],
              path: ["api", "sensors", "telemetry"],
              query: [
                { key: "gateId", value: "{{gateId}}" },
                { key: "limit", value: "30" }
              ]
            },
            description: "Retrieves chronological 5-minute telemetry intervals capturing motor temperature, battery backup voltage, ambient light (lux), tamper vibration, and obstacle distance."
          },
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test(\"Status code is 200 OK\", function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test(\"Telemetry stream has 5-minute interval metrics\", function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.success).to.be.true;",
                  "    pm.expect(json.data.length).to.be.at.least(1);",
                  "    var sample = json.data[0];",
                  "    pm.expect(sample.metrics).to.have.property('motorTemperatureC');",
                  "    pm.expect(sample.metrics).to.have.property('batteryBackupVoltage');",
                  "});"
                ],
                type: "text/javascript"
              }
            }
          ]
        },
        {
          name: "POST On-Demand 5-Minute Telemetry Sample",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                homeId: "{{homeId}}",
                gateId: "{{gateId}}"
              }, null, 2)
            },
            url: {
              raw: "{{baseUrl}}/api/sensors/generate-telemetry",
              host: ["{{baseUrl}}"],
              path: ["api", "sensors", "generate-telemetry"]
            },
            description: "Generates an instantaneous 5-minute telemetry reading document, persists it to MongoDB, and publishes an MQTT status check."
          },
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test(\"Status code is 201 Created\", function () {",
                  "    pm.response.to.have.status(201);",
                  "});",
                  "pm.test(\"5-Minute telemetry sample generated\", function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.success).to.be.true;",
                  "    pm.expect(json.interval).to.eql(\"5 minutes (300,000 ms)\");",
                  "});"
                ],
                type: "text/javascript"
              }
            }
          ]
        },
        {
          name: "POST Hardware Simulation - Resident RFID Tap",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                action: "RESIDENT_RFID",
                homeId: "{{homeId}}",
                gateId: "{{gateId}}"
              }, null, 2)
            },
            url: {
              raw: "{{baseUrl}}/api/sensors/simulate",
              host: ["{{baseUrl}}"],
              path: ["api", "sensors", "simulate"]
            },
            description: "Simulates Dr. Jane Davies tapping her authorized RFID badge (RFID-8842-A) at the gate pillar. Triggers gate opening!"
          },
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test(\"Status code is 200 OK\", function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test(\"Simulation executed successfully\", function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.success).to.be.true;",
                  "    pm.expect(json.message).to.include(\"RFID\");",
                  "});"
                ],
                type: "text/javascript"
              }
            }
          ]
        },
        {
          name: "POST Hardware Simulation - Unauthorized RFID Intruder",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                action: "UNAUTHORIZED_RFID",
                homeId: "{{homeId}}",
                gateId: "{{gateId}}"
              }, null, 2)
            },
            url: {
              raw: "{{baseUrl}}/api/sensors/simulate",
              host: ["{{baseUrl}}"],
              path: ["api", "sensors", "simulate"]
            },
            description: "Simulates an unregistered cloned RFID card presented at the pillar. Persists a WARN audit event and dispatches an instant security alert email!"
          },
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test(\"Status code is 200 OK\", function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test(\"Security alert email triggered\", function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.success).to.be.true;",
                  "    pm.expect(json.message).to.include(\"Security alert email dispatched\");",
                  "});"
                ],
                type: "text/javascript"
              }
            }
          ]
        },
        {
          name: "POST Send Unauthorized Sensor Data (Intruder Alarm & Email Alert)",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                type: "PERSON",
                identifier: "UNAUTHORIZED-PERSON-88",
                personName: "Unauthorized Person / Intruder",
                reason: "Unauthorized person entered property perimeter while gate is locked",
                homeId: "{{homeId}}",
                gateId: "{{gateId}}"
              }, null, 2)
            },
            url: {
              raw: "{{baseUrl}}/api/sensors/unauthorized",
              host: ["{{baseUrl}}"],
              path: ["api", "sensors", "unauthorized"]
            },
            description: "Directly sends unauthorized person sensor data. Verifies the gate remains firmly LOCKED, saves an INTRUSION_DETECTED event to MongoDB gate_events, broadcasts across MQTT, and dispatches an urgent security alert email to pg016742@gmail.com!"
          },
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test(\"Status code is 201 Created\", function () {",
                  "    pm.response.to.have.status(201);",
                  "});",
                  "pm.test(\"Gate remained securely locked\", function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.success).to.be.true;",
                  "    pm.expect(json.data.gateStatus).to.eql(\"LOCKED\");",
                  "    pm.expect(json.data.lockEngaged).to.be.true;",
                  "});",
                  "pm.test(\"Email notification dispatched to pg016742@gmail.com\", function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.data.emailNotification.recipient).to.include(\"pg016742@gmail.com\");",
                  "    pm.expect(json.data.emailNotification.status).to.eql(\"SECURITY_ALERT\");",
                  "});"
                ],
                type: "text/javascript"
              }
            }
          ]
        },
        {
          name: "POST Hardware Simulation - Unauthorized Person Intrusion",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                action: "UNAUTHORIZED_PERSON",
                homeId: "{{homeId}}",
                gateId: "{{gateId}}"
              }, null, 2)
            },
            url: {
              raw: "{{baseUrl}}/api/sensors/simulate",
              host: ["{{baseUrl}}"],
              path: ["api", "sensors", "simulate"]
            },
            description: "Simulates an unauthorized pedestrian entering the perimeter swing path. Gate stays LOCKED and a critical security breach alert email is dispatched to pg016742@gmail.com!"
          },
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test(\"Status code is 200 OK\", function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test(\"Intrusion alert email triggered\", function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.success).to.be.true;",
                  "    pm.expect(json.message).to.include(\"pg016742@gmail.com\");",
                  "});"
                ],
                type: "text/javascript"
              }
            }
          ]
        },
        {
          name: "POST Hardware Simulation - Unauthorized Vehicle ALPR",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                action: "UNAUTHORIZED_ALPR",
                homeId: "{{homeId}}",
                gateId: "{{gateId}}"
              }, null, 2)
            },
            url: {
              raw: "{{baseUrl}}/api/sensors/simulate",
              host: ["{{baseUrl}}"],
              path: ["api", "sensors", "simulate"]
            },
            description: "Simulates an unregistered vehicle license plate (UNKNOWN-INTRUDER-99) detected at driveway ALPR. Gate stays locked and alert email is dispatched."
          },
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test(\"Status code is 200 OK\", function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test(\"Vehicle alert email triggered\", function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.success).to.be.true;",
                  "    pm.expect(json.message).to.include(\"pg016742@gmail.com\");",
                  "});"
                ],
                type: "text/javascript"
              }
            }
          ]
        },
        {
          name: "POST Hardware Simulation - Resident ALPR Vehicle",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                action: "ALPR_VEHICLE",
                homeId: "{{homeId}}",
                gateId: "{{gateId}}"
              }, null, 2)
            },
            url: {
              raw: "{{baseUrl}}/api/sensors/simulate",
              host: ["{{baseUrl}}"],
              path: ["api", "sensors", "simulate"]
            },
            description: "Simulates ALPR optical camera scanning resident vehicle license plate 'BC24-UKS' (Audi Q5). Triggers automatic gate opening."
          },
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test(\"Status code is 200 OK\", function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test(\"ALPR vehicle simulation success\", function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.success).to.be.true;",
                  "    pm.expect(json.message).to.include(\"BC24-UKS\");",
                  "});"
                ],
                type: "text/javascript"
              }
            }
          ]
        },
        {
          name: "POST Hardware Simulation - Safety Obstacle Beam Broken",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                action: "SAFETY_OBSTACLE",
                homeId: "{{homeId}}",
                gateId: "{{gateId}}"
              }, null, 2)
            },
            url: {
              raw: "{{baseUrl}}/api/sensors/simulate",
              host: ["{{baseUrl}}"],
              path: ["api", "sensors", "simulate"]
            },
            description: "Simulates an ultrasonic and optical obstacle in the swing path during closure. Gate immediately auto-reverses!"
          },
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test(\"Status code is 200 OK\", function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test(\"Safety reverse executed\", function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.success).to.be.true;",
                  "    pm.expect(json.message).to.include(\"auto-reversed\");",
                  "});"
                ],
                type: "text/javascript"
              }
            }
          ]
        },
        {
          name: "POST Hardware Simulation - Enclosure Tamper Alarm",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                action: "TAMPER_ALARM",
                homeId: "{{homeId}}",
                gateId: "{{gateId}}"
              }, null, 2)
            },
            url: {
              raw: "{{baseUrl}}/api/sensors/simulate",
              host: ["{{baseUrl}}"],
              path: ["api", "sensors", "simulate"]
            },
            description: "Simulates high vibration (3.8G) on the control housing (forced entry/tamper). Saves CRITICAL audit event and dispatches urgent intrusion alert email!"
          },
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test(\"Status code is 200 OK\", function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test(\"Tamper alarm triggers critical email\", function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.success).to.be.true;",
                  "    pm.expect(json.message).to.include(\"Critical security alert email dispatched\");",
                  "});"
                ],
                type: "text/javascript"
              }
            }
          ]
        }
      ]
    },
    {
      name: "04 - Access Control Policies (Full CRUD & Verification)",
      description: "Complete CRUD workflow for managing access credentials (RFID tags, ALPR license plates, Bluetooth beacons) with notification email registration and credential verification.",
      item: [
        {
          name: "1. POST CRUD CREATE - Register New Access Credential",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                credentialType: "RFID_TAG",
                identifier: "RFID-POSTMAN-{{$timestamp}}",
                holderName: "Sarah Jenkins (Resident)",
                userRole: "RESIDENT",
                notificationEmail: "pg016742@gmail.com",
                schedule: {
                  is24x7: true,
                  allowedDays: [0, 1, 2, 3, 4, 5, 6],
                  timeStart: "00:00",
                  timeEnd: "23:59"
                },
                isActive: true,
                notes: "Created via Postman Automated CRUD Workflow"
              }, null, 2)
            },
            url: {
              raw: "{{baseUrl}}/api/policies",
              host: ["{{baseUrl}}"],
              path: ["api", "policies"]
            },
            description: "Creates a new access policy document in MongoDB. The test script automatically saves `createdPolicyId` and `createdPolicyIdentifier` to environment variables for subsequent requests!"
          },
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test(\"Status code is 201 Created\", function () {",
                  "    pm.response.to.have.status(201);",
                  "});",
                  "var json = pm.response.json();",
                  "pm.test(\"Policy created with valid ID\", function () {",
                  "    pm.expect(json.success).to.be.true;",
                  "    pm.expect(json.data).to.have.property('policyId');",
                  "    pm.expect(json.data.holderName).to.include('Sarah Jenkins');",
                  "});",
                  "// Auto-save created ID and identifier to Postman environment variables",
                  "pm.environment.set(\"createdPolicyId\", json.data.policyId);",
                  "pm.environment.set(\"createdPolicyIdentifier\", json.data.identifier);"
                ],
                type: "text/javascript"
              }
            }
          ]
        },
        {
          name: "2. GET CRUD READ - List All Access Policies",
          request: {
            method: "GET",
            header: [{ key: "Accept", value: "application/json" }],
            url: {
              raw: "{{baseUrl}}/api/policies?homeId={{homeId}}",
              host: ["{{baseUrl}}"],
              path: ["api", "policies"],
              query: [
                { key: "homeId", value: "{{homeId}}" },
                { key: "isActive", value: "true", disabled: true },
                { key: "credentialType", value: "RFID_TAG", disabled: true }
              ]
            },
            description: "Lists all registered access policies stored in MongoDB replica set."
          },
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test(\"Status code is 200 OK\", function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test(\"Policies list returned\", function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.success).to.be.true;",
                  "    pm.expect(json.count).to.be.at.least(1);",
                  "});"
                ],
                type: "text/javascript"
              }
            }
          ]
        },
        {
          name: "3. GET CRUD READ - Single Policy by ID",
          request: {
            method: "GET",
            header: [{ key: "Accept", value: "application/json" }],
            url: {
              raw: "{{baseUrl}}/api/policies/{{createdPolicyId}}",
              host: ["{{baseUrl}}"],
              path: ["api", "policies", "{{createdPolicyId}}"]
            },
            description: "Retrieves a specific policy by its `policyId` or `identifier` (uses the variable saved during Create)."
          },
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test(\"Status code is 200 OK\", function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test(\"Retrieved policy matches ID\", function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.success).to.be.true;",
                  "    pm.expect(json.data.policyId).to.eql(pm.environment.get(\"createdPolicyId\"));",
                  "});"
                ],
                type: "text/javascript"
              }
            }
          ]
        },
        {
          name: "4. PUT CRUD UPDATE - Modify Policy Details",
          request: {
            method: "PUT",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                holderName: "Sarah Jenkins (Updated via Postman)",
                userRole: "FAMILY_MEMBER",
                notificationEmail: "pg016742@gmail.com",
                notes: "Schedule and role updated during Postman testing"
              }, null, 2)
            },
            url: {
              raw: "{{baseUrl}}/api/policies/{{createdPolicyId}}",
              host: ["{{baseUrl}}"],
              path: ["api", "policies", "{{createdPolicyId}}"]
            },
            description: "Updates policy fields such as holderName, userRole, notificationEmail, or schedule."
          },
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test(\"Status code is 200 OK\", function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test(\"Policy updated successfully\", function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.success).to.be.true;",
                  "    pm.expect(json.data.holderName).to.include(\"Updated via Postman\");",
                  "    pm.expect(json.data.userRole).to.eql(\"FAMILY_MEMBER\");",
                  "});"
                ],
                type: "text/javascript"
              }
            }
          ]
        },
        {
          name: "5. POST Credential Verification - Authorized Entry",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                identifier: "{{createdPolicyIdentifier}}",
                notify: true
              }, null, 2)
            },
            url: {
              raw: "{{baseUrl}}/api/policies/verify",
              host: ["{{baseUrl}}"],
              path: ["api", "policies", "verify"]
            },
            description: "Verifies the credential against MongoDB policies and dispatches an authorized entry notification email."
          },
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test(\"Status code is 200 OK\", function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test(\"Credential is authorized\", function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.authorized).to.be.true;",
                  "    pm.expect(json.holderName).to.include(\"Sarah Jenkins\");",
                  "});"
                ],
                type: "text/javascript"
              }
            }
          ]
        },
        {
          name: "6. POST Credential Verification - Denied Unauthorized Attacker",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                identifier: "FAKE-RFID-CLONE-9999",
                credentialType: "RFID_TAG",
                notify: true
              }, null, 2)
            },
            url: {
              raw: "{{baseUrl}}/api/policies/verify",
              host: ["{{baseUrl}}"],
              path: ["api", "policies", "verify"]
            },
            description: "Simulates an unknown/unregistered credential verification attempt. Returns authorized: false and dispatches an intrusion alert email."
          },
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test(\"Status code is 200 OK\", function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test(\"Credential is correctly rejected\", function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.authorized).to.be.false;",
                  "    pm.expect(json.reason).to.include(\"Unregistered\");",
                  "});"
                ],
                type: "text/javascript"
              }
            }
          ]
        },
        {
          name: "7. DELETE CRUD DELETE - Revoke Access Credential",
          request: {
            method: "DELETE",
            header: [{ key: "Accept", value: "application/json" }],
            url: {
              raw: "{{baseUrl}}/api/policies/{{createdPolicyId}}",
              host: ["{{baseUrl}}"],
              path: ["api", "policies", "{{createdPolicyId}}"]
            },
            description: "Revokes and deletes the policy document from MongoDB (CRUD: DELETE)."
          },
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test(\"Status code is 200 OK\", function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test(\"Policy deleted successfully\", function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.success).to.be.true;",
                  "    pm.expect(json.message).to.include(\"CRUD: DELETE\");",
                  "});"
                ],
                type: "text/javascript"
              }
            }
          ]
        }
      ]
    },
    {
      name: "05 - Email Notifications & Security Intrusion Alerts",
      description: "Direct endpoints for testing real-time transactional email notifications via Nodemailer (dispatched to homeowner inbox pg016742@gmail.com).",
      item: [
        {
          name: "GET Query Dispatched Notification Logs",
          request: {
            method: "GET",
            header: [{ key: "Accept", value: "application/json" }],
            url: {
              raw: "{{baseUrl}}/api/notifications",
              host: ["{{baseUrl}}"],
              path: ["api", "notifications"]
            },
            description: "Retrieves the log of recently dispatched email notifications, including recipients, timestamps, delivery status, and simulated/SMTP transport mode."
          },
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test(\"Status code is 200 OK\", function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test(\"Notification logs list returned\", function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.success).to.be.true;",
                  "    pm.expect(json).to.have.property('count');",
                  "    pm.expect(Array.isArray(json.data)).to.be.true;",
                  "});"
                ],
                type: "text/javascript"
              }
            }
          ]
        },
        {
          name: "POST Trigger Authorized Entry Notification Email",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                email: "pg016742@gmail.com",
                holderName: "Pramod (Resident)",
                userRole: "RESIDENT"
              }, null, 2)
            },
            url: {
              raw: "{{baseUrl}}/api/notifications/test",
              host: ["{{baseUrl}}"],
              path: ["api", "notifications", "test"]
            },
            description: "Dispatches a clean HTML notification email simulating an authorized family member or resident entering through the gate."
          },
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test(\"Status code is 200 OK\", function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test(\"Authorized email dispatched\", function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.success).to.be.true;",
                  "    pm.expect(json.data.recipient).to.include(\"pg016742@gmail.com\");",
                  "});"
                ],
                type: "text/javascript"
              }
            }
          ]
        },
        {
          name: "POST Trigger Unauthorized Intruder Security Alert Email",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                email: "pg016742@gmail.com",
                identifier: "UNKNOWN-INTRUDER-99",
                credentialType: "RFID_TAG",
                reason: "Unregistered intruder RFID card detected at gate pillar during postman test"
              }, null, 2)
            },
            url: {
              raw: "{{baseUrl}}/api/notifications/test-unauthorized",
              host: ["{{baseUrl}}"],
              path: ["api", "notifications", "test-unauthorized"]
            },
            description: "Dispatches an urgent RED security alert email to the homeowner warning of an unauthorized entry or intrusion attempt."
          },
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test(\"Status code is 200 OK\", function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test(\"Security alert email dispatched\", function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.success).to.be.true;",
                  "    pm.expect(json.data.status).to.eql(\"SECURITY_ALERT\");",
                  "});"
                ],
                type: "text/javascript"
              }
            }
          ]
        }
      ]
    },
    {
      name: "06 - Predictive Analytics & Aggregation Pipelines",
      description: "Complex MongoDB multi-stage aggregation pipelines: 24-hour peak traffic, security incident counts, predictive motor duty health, and 3-core sensor diagnostics.",
      item: [
        {
          name: "GET 24-Hour Peak Traffic Hourly Aggregation",
          request: {
            method: "GET",
            header: [{ key: "Accept", value: "application/json" }],
            url: {
              raw: "{{baseUrl}}/api/analytics/hourly-traffic?homeId={{homeId}}&days=30",
              host: ["{{baseUrl}}"],
              path: ["api", "analytics", "hourly-traffic"],
              query: [
                { key: "homeId", value: "{{homeId}}" },
                { key: "days", value: "30" }
              ]
            },
            description: "MongoDB `$group` aggregation bucketing sensor activation events into 24 hour slots (0..23) over the past 30 days to detect morning (07:00-09:00) and evening (17:00-19:00) peak rush hours."
          },
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test(\"Status code is 200 OK\", function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test(\"24 hourly buckets returned\", function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.success).to.be.true;",
                  "    pm.expect(json.data.length).to.eql(24);",
                  "});"
                ],
                type: "text/javascript"
              }
            }
          ]
        },
        {
          name: "GET Security Incident Aggregation",
          request: {
            method: "GET",
            header: [{ key: "Accept", value: "application/json" }],
            url: {
              raw: "{{baseUrl}}/api/analytics/security?homeId={{homeId}}&days=30",
              host: ["{{baseUrl}}"],
              path: ["api", "analytics", "security"],
              query: [
                { key: "homeId", value: "{{homeId}}" },
                { key: "days", value: "30" }
              ]
            },
            description: "MongoDB aggregation analyzing security events: unauthorized access attempts, optical safety reversals, and anti-tamper vibrations."
          },
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test(\"Status code is 200 OK\", function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test(\"Security analytics returned\", function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.success).to.be.true;",
                  "    pm.expect(json.data).to.have.property('totalSecurityIncidents');",
                  "});"
                ],
                type: "text/javascript"
              }
            }
          ]
        },
        {
          name: "GET Predictive Motor Health & Duty Cycle Forecast",
          request: {
            method: "GET",
            header: [{ key: "Accept", value: "application/json" }],
            url: {
              raw: "{{baseUrl}}/api/analytics/motor-health?gateId={{gateId}}",
              host: ["{{baseUrl}}"],
              path: ["api", "analytics", "motor-health"],
              query: [
                { key: "gateId", value: "{{gateId}}" }
              ]
            },
            description: "Calculates total mechanical actuation cycles, motor winding temperature trends, estimated duty wear, and days remaining until servicing."
          },
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test(\"Status code is 200 OK\", function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test(\"Motor health score returned\", function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.success).to.be.true;",
                  "    pm.expect(json.data).to.have.property('healthScore');",
                  "    pm.expect(json.data).to.have.property('status');",
                  "});"
                ],
                type: "text/javascript"
              }
            }
          ]
        },
        {
          name: "GET 3-Core Sensor Health & Diagnostic Aggregation",
          request: {
            method: "GET",
            header: [{ key: "Accept", value: "application/json" }],
            url: {
              raw: "{{baseUrl}}/api/analytics/sensor-health?gateId={{gateId}}",
              host: ["{{baseUrl}}"],
              path: ["api", "analytics", "sensor-health"],
              query: [
                { key: "gateId", value: "{{gateId}}" }
              ]
            },
            description: "Returns rigorous health, diagnostics, and telemetry analysis for the 3 core physical sensors required by the assessment brief: Safety Photocell Infrared Beam, Mechanical Limit Switch, and RFID Pillar Reader."
          },
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test(\"Status code is 200 OK\", function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test(\"3 Core sensors verified\", function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.success).to.be.true;",
                  "    pm.expect(json.data).to.have.property('photocell');",
                  "    pm.expect(json.data).to.have.property('limitSwitch');",
                  "    pm.expect(json.data).to.have.property('rfidReader');",
                  "});"
                ],
                type: "text/javascript"
              }
            }
          ]
        },
        {
          name: "GET Executive Dashboard KPI Summary",
          request: {
            method: "GET",
            header: [{ key: "Accept", value: "application/json" }],
            url: {
              raw: "{{baseUrl}}/api/analytics/summary?homeId={{homeId}}",
              host: ["{{baseUrl}}"],
              path: ["api", "analytics", "summary"],
              query: [
                { key: "homeId", value: "{{homeId}}" }
              ]
            },
            description: "High-level summary of total events, active access policies, 24h activations, security incidents, and overall system status."
          },
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "pm.test(\"Status code is 200 OK\", function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test(\"Summary contains operational KPIs\", function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.success).to.be.true;",
                  "    pm.expect(json.data).to.have.property('totalEvents');",
                  "    pm.expect(json.data).to.have.property('activePolicies');",
                  "});"
                ],
                type: "text/javascript"
              }
            }
          ]
        }
      ]
    }
  ]
};

const environment = {
  id: "8c1e4d3a-231b-4f91-8854-d8329bfae76c",
  name: "IoThings Local Development (localhost:3000)",
  values: [
    {
      key: "baseUrl",
      value: "http://localhost:3000",
      type: "default",
      enabled: true
    },
    {
      key: "homeId",
      value: "home_uk_01",
      type: "default",
      enabled: true
    },
    {
      key: "gateId",
      value: "gate_main_01",
      type: "default",
      enabled: true
    },
    {
      key: "alertEmail",
      value: "pg016742@gmail.com",
      type: "default",
      enabled: true
    },
    {
      key: "createdPolicyId",
      value: "",
      type: "default",
      enabled: true
    },
    {
      key: "createdPolicyIdentifier",
      value: "RFID-POSTMAN-8842",
      type: "default",
      enabled: true
    }
  ],
  _postman_variable_scope: "environment"
};

// Ensure postman directory exists
const postmanDir = path.join(__dirname, '../postman');
if (!fs.existsSync(postmanDir)) {
  fs.mkdirSync(postmanDir, { recursive: true });
}

// Write to postman directory
const collPathPostman = path.join(postmanDir, 'IoThings_Smart_Gate.postman_collection.json');
const envPathPostman = path.join(postmanDir, 'IoThings_Local.postman_environment.json');

fs.writeFileSync(collPathPostman, JSON.stringify(collection, null, 2));
fs.writeFileSync(envPathPostman, JSON.stringify(environment, null, 2));

// Also write copies in root for ultimate convenience
const collPathRoot = path.join(__dirname, '../postman_collection.json');
const envPathRoot = path.join(__dirname, '../postman_environment.json');

fs.writeFileSync(collPathRoot, JSON.stringify(collection, null, 2));
fs.writeFileSync(envPathRoot, JSON.stringify(environment, null, 2));

console.log('✓ Successfully generated Postman Collection and Environment files:');
console.log('  -> ' + collPathPostman);
console.log('  -> ' + envPathPostman);
console.log('  -> ' + collPathRoot);
console.log('  -> ' + envPathRoot);
