// State variables
let currentGateState = {
  status: 'LOCKED',
  lockEngaged: true,
  reedSwitchState: 'CLOSED',
  obstacleDistanceCm: 250,
  pirMotionDetected: false,
  motorCurrentAmps: 0.0
};

let eventFilter = 'ALL';

// Audio & Sound Ring State
let soundEnabled = true;
let audioCtx = null;
let activeAlarmOscillators = [];
let alarmAutoSilenceTimer = null;
let lastAlertTimestamp = Date.now();

// Lazy-initialize Web Audio Context
function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Ensure audio context is ready on first user gesture
['click', 'touchstart', 'keydown'].forEach(evt => {
  document.addEventListener(evt, () => {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }, { passive: true });
});

// Play Urgent Dual-Tone Security Alarm Siren Ring via Web Audio API
function playAlarmSiren(durationSeconds = 3.6) {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  stopAlarmAudio();

  const now = ctx.currentTime;
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc1.type = 'sawtooth';
  osc2.type = 'triangle';

  // Realistic siren pitch oscillation (680Hz to 980Hz sweeps)
  const cycleDur = 0.36;
  const cycles = Math.floor(durationSeconds / cycleDur);
  for (let i = 0; i < cycles; i++) {
    const t = now + i * cycleDur;
    osc1.frequency.setValueAtTime(680, t);
    osc1.frequency.exponentialRampToValueAtTime(980, t + cycleDur * 0.5);
    osc1.frequency.exponentialRampToValueAtTime(680, t + cycleDur);

    osc2.frequency.setValueAtTime(1020, t);
    osc2.frequency.exponentialRampToValueAtTime(1470, t + cycleDur * 0.5);
    osc2.frequency.exponentialRampToValueAtTime(1020, t + cycleDur);
  }

  // Master volume envelope
  gainNode.gain.setValueAtTime(0.001, now);
  gainNode.gain.exponentialRampToValueAtTime(0.25, now + 0.04);
  gainNode.gain.setValueAtTime(0.25, now + durationSeconds - 0.1);
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + durationSeconds);

  osc1.connect(gainNode);
  osc2.connect(gainNode);
  gainNode.connect(ctx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + durationSeconds);
  osc2.stop(now + durationSeconds);

  activeAlarmOscillators.push(osc1, osc2, gainNode);
}

// Play Clean Pleasant Resident Access Granted Chime (C5 -> E5 -> G5 -> C6)
function playAccessChime() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const notes = [
    { freq: 523.25, time: 0.00, dur: 0.18 }, // C5
    { freq: 659.25, time: 0.10, dur: 0.18 }, // E5
    { freq: 783.99, time: 0.20, dur: 0.22 }, // G5
    { freq: 1046.50, time: 0.30, dur: 0.45 }  // C6
  ];

  const now = ctx.currentTime;
  notes.forEach(n => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(n.freq, now + n.time);

    gain.gain.setValueAtTime(0.001, now + n.time);
    gain.gain.exponentialRampToValueAtTime(0.2, now + n.time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + n.time + n.dur);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + n.time);
    osc.stop(now + n.time + n.dur);
  });
}

// Stop any currently playing alarm siren sound
function stopAlarmAudio() {
  activeAlarmOscillators.forEach(node => {
    try {
      if (node.stop) node.stop();
      if (node.disconnect) node.disconnect();
    } catch (_) {}
  });
  activeAlarmOscillators = [];
}

// Trigger Visual and Audio Security Intrusion Alarm
function triggerSecurityAlarm({ details, previewUrl } = {}) {
  const banner = document.getElementById('alarm-banner');
  const detailsEl = document.getElementById('alarm-details-text');
  const viewEmailBtn = document.getElementById('alarm-view-email-btn');

  if (details && detailsEl) {
    detailsEl.innerHTML = details;
  }

  if (viewEmailBtn) {
    if (previewUrl) {
      viewEmailBtn.href = previewUrl;
      viewEmailBtn.style.display = 'inline-flex';
    } else {
      viewEmailBtn.style.display = 'none';
    }
  }

  if (banner) {
    banner.classList.remove('hidden');
  }

  const vWrapper = document.getElementById('visual-wrapper');
  if (vWrapper) {
    vWrapper.classList.add('alarm-ringing');
  }

  // Ring the Siren Sound
  playAlarmSiren(4.0);

  // Auto-silence after 10 seconds
  if (alarmAutoSilenceTimer) clearTimeout(alarmAutoSilenceTimer);
  alarmAutoSilenceTimer = setTimeout(() => {
    silenceAlarm(true);
  }, 10000);
}

// Silence the Alarm Siren and Hide Banner
function silenceAlarm(auto = false) {
  stopAlarmAudio();
  if (alarmAutoSilenceTimer) {
    clearTimeout(alarmAutoSilenceTimer);
    alarmAutoSilenceTimer = null;
  }

  const banner = document.getElementById('alarm-banner');
  if (banner) banner.classList.add('hidden');

  const vWrapper = document.getElementById('visual-wrapper');
  if (vWrapper) {
    vWrapper.classList.remove('alarm-ringing');
  }

  if (!auto) {
    showSimFeedback('🔕 Alarm siren silenced by operator.');
  }
}

// Toggle Sound Ring Enabled/Muted
function toggleSound() {
  soundEnabled = !soundEnabled;
  const pill = document.getElementById('sound-status-pill');
  const dot = document.getElementById('sound-dot');
  const text = document.getElementById('sound-state-text');

  if (soundEnabled) {
    if (pill) pill.classList.remove('muted');
    if (dot) dot.classList.remove('muted');
    if (text) text.textContent = 'ENABLED';
    showSimFeedback('🔔 Siren Ring sound ENABLED.');
    playAccessChime();
  } else {
    if (pill) pill.classList.add('muted');
    if (dot) dot.classList.add('muted');
    if (text) text.textContent = 'MUTED';
    silenceAlarm(true);
    showSimFeedback('🔕 Siren Ring sound MUTED.');
  }
}

// DOM Elements
const gateBadge = document.getElementById('gate-badge');
const visualWrapper = document.getElementById('visual-wrapper');
const leafLeft = document.getElementById('leaf-left');
const leafRight = document.getElementById('leaf-right');
const deadboltIcon = document.getElementById('deadbolt-icon');
const safetyBeam = document.getElementById('safety-beam');
const reedStateText = document.getElementById('reed-state-text');
const lockStateText = document.getElementById('lock-state-text');
const motorAmpsText = document.getElementById('motor-amps-text');

// Telemetry Elements
const valDistance = document.getElementById('val-distance');
const barDistance = document.getElementById('bar-distance');
const valPir = document.getElementById('val-pir');
const pirSubtext = document.getElementById('pir-subtext');
const valMotorAmps = document.getElementById('val-motor-amps');
const valTemp = document.getElementById('val-temp');
const valBattery = document.getElementById('val-battery');
const valVibration = document.getElementById('val-vibration');
const simFeedback = document.getElementById('sim-feedback-box');

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', () => {
  initClock();
  initSSE();
  fetchGateStatus();
  fetchClusterStatus();
  fetchPolicies();
  fetchAnalytics();
  fetchEvents();
  fetchNotifications();
  setupEventListeners();

  // Periodic refreshes
  setInterval(fetchGateStatus, 2000);
  setInterval(fetchEvents, 4000);
  setInterval(fetchNotifications, 4000);
  setInterval(fetchClusterStatus, 10000);
});

function initClock() {
  const clockEl = document.getElementById('live-clock');
  function update() {
    const d = new Date();
    clockEl.textContent = d.toTimeString().split(' ')[0];
  }
  update();
  setInterval(update, 1000);
}

// Server-Sent Events (SSE) for Real-Time Streaming
function initSSE() {
  if (window.EventSource) {
    const source = new EventSource('/api/stream');
    source.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.payload) {
          applyGateState(msg.payload);
        }
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    };
    source.onerror = () => {
      // Graceful fallback to HTTP polling
    };
  }
}

// Apply Gate State to UI Visualizer and Gauges
function applyGateState(state) {
  currentGateState = { ...currentGateState, ...state };

  // Status Badge
  gateBadge.className = `state-badge state-${currentGateState.status}`;
  gateBadge.textContent = currentGateState.status.replace('_', ' ');

  // Visual Wrapper Class for CSS animations
  visualWrapper.className = `gate-visual-wrapper gate-state-${currentGateState.status}`;

  // Solenoid Deadbolt Lock
  if (currentGateState.lockEngaged) {
    deadboltIcon.className = 'deadbolt-lock-icon';
    deadboltIcon.textContent = '🔒';
    lockStateText.textContent = 'LOCK: ENGAGED';
    lockStateText.style.color = '#fb7185';
  } else {
    deadboltIcon.className = 'deadbolt-lock-icon unlocked';
    deadboltIcon.textContent = '🔓';
    lockStateText.textContent = 'LOCK: RELEASED';
    lockStateText.style.color = '#34d399';
  }

  // Reed Switch State
  reedStateText.textContent = `REED: ${currentGateState.reedSwitchState || 'CLOSED'}`;

  // Motor Load
  const amps = currentGateState.motorCurrentAmps || 0;
  motorAmpsText.textContent = `${amps.toFixed(1)} A`;
  valMotorAmps.innerHTML = `${amps.toFixed(1)} <span style="font-size: 0.9rem; font-weight: 400; color: var(--text-muted);">Amps</span>`;

  // Ultrasonic Distance
  const dist = currentGateState.obstacleDistanceCm || 250;
  valDistance.innerHTML = `${dist} <span style="font-size: 0.9rem; font-weight: 400; color: var(--text-muted);">cm</span>`;
  const pct = Math.min(100, Math.max(5, (dist / 300) * 100));
  barDistance.style.width = `${pct}%`;

  if (dist < 45) {
    safetyBeam.classList.add('obstructed');
    barDistance.style.background = '#f43f5e';
  } else {
    safetyBeam.classList.remove('obstructed');
    barDistance.style.background = 'linear-gradient(90deg, var(--accent-cyan), var(--accent-blue))';
  }

  // PIR Motion
  if (currentGateState.pirMotionDetected) {
    valPir.textContent = 'MOTION DETECTED';
    valPir.style.color = 'var(--accent-amber)';
    pirSubtext.textContent = 'Active object in detection cone';
  } else {
    valPir.textContent = 'CLEAR';
    valPir.style.color = 'var(--accent-emerald)';
    pirSubtext.textContent = 'No pedestrian in perimeter';
  }

  // 1. Photocell UI Rendering (Optical signal strength %, dirty lens check, beam continuity)
  const photocell = currentGateState.photocell || {
    healthStatus: dist < 45 ? 'OBSTRUCTED' : 'HEALTHY',
    opticalSignalStrength: dist < 45 ? 14.0 : 96.0,
    beamContinuity: dist >= 45
  };
  const valPhotoSignal = document.getElementById('val-photocell-signal');
  const barPhotoSignal = document.getElementById('bar-photocell-signal');
  const badgePhotoHealth = document.getElementById('photocell-health-badge');
  const valBeamCont = document.getElementById('val-beam-continuity');
  const photoLensStatus = document.getElementById('photocell-lens-status');

  if (valPhotoSignal) {
    valPhotoSignal.innerHTML = `${photocell.opticalSignalStrength.toFixed(1)} <span style="font-size: 0.85rem; font-weight: 400; color: var(--text-muted);">% Signal</span>`;
    barPhotoSignal.style.width = `${Math.min(100, Math.max(5, photocell.opticalSignalStrength))}%`;
    if (photocell.opticalSignalStrength < 65) {
      barPhotoSignal.style.background = '#f59e0b';
    } else {
      barPhotoSignal.style.background = 'linear-gradient(90deg, #06b6d4, #10b981)';
    }
    badgePhotoHealth.textContent = photocell.healthStatus;
    if (photocell.healthStatus === 'DIRTY_LENS_WARNING') {
      badgePhotoHealth.style.background = 'rgba(245, 158, 11, 0.15)';
      badgePhotoHealth.style.color = '#fbbf24';
      photoLensStatus.textContent = 'Dirty Lens Warning';
      photoLensStatus.style.color = '#fbbf24';
    } else if (photocell.healthStatus === 'MISALIGNED') {
      badgePhotoHealth.style.background = 'rgba(244, 63, 94, 0.15)';
      badgePhotoHealth.style.color = '#fb7185';
      photoLensStatus.textContent = 'Misaligned Beam';
      photoLensStatus.style.color = '#fb7185';
    } else {
      badgePhotoHealth.style.background = 'rgba(16, 185, 129, 0.15)';
      badgePhotoHealth.style.color = '#34d399';
      photoLensStatus.textContent = 'Lenses Clean';
      photoLensStatus.style.color = '#9ca3af';
    }

    if (photocell.beamContinuity) {
      valBeamCont.textContent = 'CONTINUOUS';
      valBeamCont.style.color = '#34d399';
    } else {
      valBeamCont.textContent = 'OBSTRUCTED';
      valBeamCont.style.color = '#fb7185';
    }
  }

  // 2. Limit Switch UI Rendering (Confirmation of resting state, ambient motor temp, standby power)
  const limitSwitch = currentGateState.limitSwitch || {
    restingState: (currentGateState.status === 'LOCKED' || currentGateState.status === 'IDLE_CLOSED') ? 'FULLY_CLOSED' : (currentGateState.status === 'OPEN' ? 'FULLY_OPEN' : 'AJAR'),
    ambientMotorTemperatureC: 21.5,
    standbyPowerWatts: (currentGateState.status === 'LOCKED' || currentGateState.status === 'IDLE_CLOSED') ? 2.1 : 48.0
  };
  const valLimitRest = document.getElementById('val-limitswitch-resting');
  const badgeLimit = document.getElementById('limitswitch-state-badge');
  const valLimitTemp = document.getElementById('val-limitswitch-temp');
  const valLimitPower = document.getElementById('val-limitswitch-power');

  if (valLimitRest) {
    valLimitRest.textContent = limitSwitch.restingState;
    if (limitSwitch.restingState === 'FULLY_CLOSED') {
      valLimitRest.style.color = '#60a5fa';
      badgeLimit.textContent = 'RESTING';
      badgeLimit.style.background = 'rgba(59, 130, 246, 0.15)';
      badgeLimit.style.color = '#93c5fd';
    } else if (limitSwitch.restingState === 'FULLY_OPEN') {
      valLimitRest.style.color = '#34d399';
      badgeLimit.textContent = 'HELD OPEN';
      badgeLimit.style.background = 'rgba(16, 185, 129, 0.15)';
      badgeLimit.style.color = '#34d399';
    } else {
      valLimitRest.style.color = '#fbbf24';
      badgeLimit.textContent = 'TRANSIT';
      badgeLimit.style.background = 'rgba(245, 158, 11, 0.15)';
      badgeLimit.style.color = '#fbbf24';
    }
    valLimitTemp.textContent = `${limitSwitch.ambientMotorTemperatureC.toFixed(1)} °C`;
    valLimitPower.textContent = `${limitSwitch.standbyPowerWatts.toFixed(2)} W`;
  }

  // 3. RFID Reader UI Rendering (Operational heartbeat, antenna status, background noise level)
  const rfid = currentGateState.rfidReader || {
    operationalHeartbeat: true,
    antennaStatus: 'OPTIMAL',
    backgroundNoiseDbm: -82.5
  };
  const valRfidNoise = document.getElementById('val-rfid-noise');
  const valRfidAntenna = document.getElementById('val-rfid-antenna');
  const badgeRfidHeartbeat = document.getElementById('rfid-heartbeat-badge');

  if (valRfidNoise) {
    valRfidNoise.innerHTML = `${rfid.backgroundNoiseDbm.toFixed(1)} <span style="font-size: 0.85rem; font-weight: 400; color: var(--text-muted);">dBm Noise</span>`;
    valRfidAntenna.textContent = rfid.antennaStatus;
    valRfidAntenna.style.color = (rfid.antennaStatus === 'OPTIMAL' || rfid.antennaStatus === 'TUNED') ? '#34d399' : '#fbbf24';
    badgeRfidHeartbeat.textContent = rfid.operationalHeartbeat ? 'HEARTBEAT: OK' : 'HEARTBEAT: LOST';
    badgeRfidHeartbeat.style.color = rfid.operationalHeartbeat ? '#c084fc' : '#fb7185';
  }
}

// Fetch Current Gate Status from REST API
async function fetchGateStatus() {
  try {
    const res = await fetch('/api/gate/status');
    const json = await res.json();
    if (json.success && json.data) {
      applyGateState(json.data);
    }
  } catch (err) {
    console.warn('Status poll error:', err);
  }
}

// Dispatch Gate Command via REST API (which publishes to MQTT)
async function sendCommand(action) {
  try {
    showSimFeedback(`Publishing command '${action}' to MQTT topic...`);
    const res = await fetch('/api/gate/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reason: `Web UI button '${action}'` })
    });
    const json = await res.json();
    if (json.success) {
      showSimFeedback(`✓ Command '${action}' accepted and published to MQTT!`);
      setTimeout(fetchGateStatus, 300);
      setTimeout(fetchEvents, 500);
    } else {
      showSimFeedback(`✗ Error: ${json.error}`);
    }
  } catch (err) {
    showSimFeedback(`✗ Network error: ${err.message}`);
  }
}

// Trigger Simulated IoT Sensor Event
async function triggerSimulation(simType) {
  try {
    showSimFeedback(`Simulating IoT Sensor event: ${simType}...`);

    // Audio & Security Ring Trigger based on event type
    if (simType === 'RESIDENT_RFID' || simType === 'ALPR_VEHICLE') {
      playAccessChime();
    } else if (simType === 'UNAUTHORIZED_RFID' || simType === 'UNAUTHORIZED_PERSON' || simType === 'UNAUTHORIZED_ALPR' || simType === 'TAMPER_ALARM') {
      let desc = 'Unauthorized perimeter breach detected at Main Gate! Alert email dispatched to <strong>pg016742@gmail.com</strong>.';
      if (simType === 'UNAUTHORIZED_RFID') {
        desc = 'Unregistered RFID Tag scanned. Access <strong>DENIED</strong>. Solenoid deadbolt stays locked. Dispatched security alert email to <strong>pg016742@gmail.com</strong>.';
      } else if (simType === 'UNAUTHORIZED_PERSON') {
        desc = 'Unauthorized pedestrian detected breaching perimeter. Access <strong>DENIED</strong>. Gate locked. Dispatched security alert email to <strong>pg016742@gmail.com</strong>.';
      } else if (simType === 'UNAUTHORIZED_ALPR') {
        desc = 'Unregistered vehicle license plate detected. Access <strong>DENIED</strong>. Dispatched security alert email to <strong>pg016742@gmail.com</strong>.';
      } else if (simType === 'TAMPER_ALARM') {
        desc = 'Severe 3.8G enclosure tamper vibration detected! Dispatched critical security anomaly email to <strong>pg016742@gmail.com</strong>.';
      }
      triggerSecurityAlarm({ details: desc });
    }

    const res = await fetch('/api/sensors/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: simType })
    });
    const json = await res.json();
    if (json.success) {
      showSimFeedback(`✓ ${json.message}`);
      if (json.previewUrl) {
        const viewEmailBtn = document.getElementById('alarm-view-email-btn');
        if (viewEmailBtn) {
          viewEmailBtn.href = json.previewUrl;
          viewEmailBtn.style.display = 'inline-flex';
        }
      }
      setTimeout(fetchGateStatus, 500);
      setTimeout(fetchEvents, 600);
      setTimeout(fetchNotifications, 700);
    } else {
      showSimFeedback(`✗ Simulation error: ${json.error}`);
    }
  } catch (err) {
    showSimFeedback(`✗ Error: ${err.message}`);
  }
}

function showSimFeedback(msg) {
  simFeedback.textContent = msg;
}

// Fetch MongoDB 3-Node Cluster Health
async function fetchClusterStatus() {
  try {
    const res = await fetch('/api/cluster/status');
    const json = await res.json();
    if (!json.success || !json.data) return;

    const data = json.data;
    const container = document.getElementById('cluster-nodes-container');
    const clusterStateText = document.getElementById('cluster-state-text');

    if (data.replicaSet) {
      clusterStateText.textContent = `${data.replicaSet} (${data.members.length} Nodes Active)`;
    }

    if (data.members && data.members.length > 0) {
      container.innerHTML = data.members.map(node => {
        const isPrimary = node.state === 'PRIMARY';
        return `
          <div class="node-card ${isPrimary ? 'primary' : ''}">
            <div class="node-header">
              <span class="status-dot active"></span>
              <span>${node.name}</span>
            </div>
            <div class="node-meta">State: <strong style="color: ${isPrimary ? '#34d399' : '#93c5fd'};">${node.state}</strong> | Health: ${node.health === 1 ? '100%' : 'Degraded'}</div>
            <div class="node-meta">${isPrimary ? 'Replica Role: Write Leader & Majority Consensus' : 'Replica Role: Real-time Oplog Sync & Read Pool'}</div>
            <div class="node-meta" style="font-size: 0.7rem; color: var(--text-dim); margin-top: 4px;">Ping: ${node.pingMs}ms | Uptime: ${Math.floor(node.uptime / 60)}m</div>
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    console.error('Cluster status error:', err);
  }
}

// Access Policies CRUD: Fetch and Render Table
async function fetchPolicies() {
  const tbody = document.getElementById('policies-tbody');
  try {
    const res = await fetch('/api/policies');
    const json = await res.json();
    if (!json.success || !json.data) return;

    if (json.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">No policies registered.</td></tr>';
      return;
    }

    tbody.innerHTML = json.data.map(p => `
      <tr>
        <td><code>${p.credentialType}</code></td>
        <td><strong>${p.identifier}</strong></td>
        <td>${p.holderName}</td>
        <td><span class="role-badge role-${p.userRole}">${p.userRole}</span></td>
        <td>
          <span style="font-size: 0.75rem; color: #a5b4fc; font-family: monospace;">
            ${p.notificationEmail || '<span style="color: var(--text-dim); font-style: italic;">homeowner@iothings.co.uk</span>'}
          </span>
        </td>
        <td>
          <span style="color: ${p.isActive ? '#34d399' : '#fb7185'}; font-size: 0.75rem; font-weight: 600;">
            ${p.isActive ? '● ACTIVE' : '○ INACTIVE'}
          </span>
        </td>
        <td>
          <button class="btn btn-stop" style="padding: 0.2rem 0.5rem; font-size: 0.7rem;" onclick="deletePolicy('${p.policyId}')">
            Delete
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="color: #fb7185;">Failed to load policies: ${err.message}</td></tr>`;
  }
}

// Access Policies CRUD: Delete Policy
async function deletePolicy(policyId) {
  if (!confirm(`Are you sure you want to revoke and delete policy '${policyId}' from MongoDB?`)) return;
  try {
    const res = await fetch(`/api/policies/${policyId}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      showSimFeedback(`✓ Access policy ${policyId} deleted (CRUD: DELETE)`);
      fetchPolicies();
    }
  } catch (err) {
    alert(`Delete failed: ${err.message}`);
  }
}

// Access Policies CRUD: Create Policy from Modal
async function handleCreatePolicy(e) {
  e.preventDefault();
  const type = document.getElementById('policy-type').value;
  const identifier = document.getElementById('policy-identifier').value;
  const holderName = document.getElementById('policy-name').value;
  const email = document.getElementById('policy-email').value;
  const userRole = document.getElementById('policy-role').value;

  try {
    const res = await fetch('/api/policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        credentialType: type,
        identifier: identifier.trim(),
        holderName: holderName.trim(),
        notificationEmail: email ? email.trim() : '',
        userRole: userRole
      })
    });

    const json = await res.json();
    if (json.success) {
      document.getElementById('add-policy-modal').classList.remove('active');
      document.getElementById('add-policy-form').reset();
      showSimFeedback(`✓ Registered new ${type} for ${holderName} (CRUD: CREATE)`);
      fetchPolicies();
    } else {
      alert(`Registration error: ${json.error}`);
    }
  } catch (err) {
    alert(`Network error: ${err.message}`);
  }
}

// Fetch Analytics & Render Chart via Canvas
async function fetchAnalytics() {
  try {
    const [trafficRes, motorRes] = await Promise.all([
      fetch('/api/analytics/hourly-traffic'),
      fetch('/api/analytics/motor-health')
    ]);

    const trafficJson = await trafficRes.json();
    const motorJson = await motorRes.json();

    if (trafficJson.success && trafficJson.data) {
      drawTrafficChart(trafficJson.data);
    }

    if (motorJson.success && motorJson.data) {
      const mh = motorJson.data;
      document.getElementById('motor-health-score').textContent = `${mh.healthScore} / 100 (${mh.status})`;
      document.getElementById('motor-health-score').style.color = mh.healthScore > 80 ? '#34d399' : '#fbbf24';
      document.getElementById('total-cycles-count').textContent = `${mh.totalCycles} cycles`;
    }
  } catch (err) {
    console.error('Analytics error:', err);
  }
}

// Draw Modern Bar Chart on Canvas
function drawTrafficChart(data) {
  const canvas = document.getElementById('traffic-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);

  const paddingLeft = 35;
  const paddingBottom = 25;
  const chartWidth = width - paddingLeft - 10;
  const chartHeight = height - paddingBottom - 10;

  const maxVal = Math.max(...data.map(d => d.totalCount), 10);
  const barWidth = chartWidth / data.length;

  // Draw background grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = 10 + (chartHeight / 4) * i;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(width - 10, y);
    ctx.stroke();

    const val = Math.round(maxVal - (maxVal / 4) * i);
    ctx.fillStyle = '#6b7280';
    ctx.font = '10px Outfit, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(val.toString(), paddingLeft - 6, y + 3);
  }

  // Draw Bars
  data.forEach((d, idx) => {
    const barHeight = (d.totalCount / maxVal) * chartHeight;
    const x = paddingLeft + idx * barWidth + 2;
    const y = height - paddingBottom - barHeight;
    const w = Math.max(2, barWidth - 4);

    // Gradient bar fill
    const grad = ctx.createLinearGradient(0, y, 0, height - paddingBottom);
    grad.addColorStop(0, '#06b6d4');
    grad.addColorStop(1, 'rgba(99, 102, 241, 0.4)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, w, barHeight, [3, 3, 0, 0]);
    ctx.fill();

    // Hour label on every 4th bar
    if (idx % 4 === 0) {
      ctx.fillStyle = '#9ca3af';
      ctx.font = '9px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${idx}h`, x + w / 2, height - 8);
    }
  });
}

// Fetch and Render Live Audit Events Feed
async function fetchEvents() {
  const container = document.getElementById('events-stream-list');
  try {
    let url = '/api/sensors/events?limit=25';
    if (eventFilter === 'SECURITY') url += '&severity=WARN';
    if (eventFilter === 'SAFETY') url += '&eventType=SAFETY_OBSTACLE_DETECTED';

    const res = await fetch(url);
    const json = await res.json();
    if (!json.success || !json.data) return;

    if (json.data.length === 0) {
      container.innerHTML = '<div style="padding: 1rem; color: var(--text-muted); text-align: center;">No events matching current filter.</div>';
      return;
    }

    container.innerHTML = json.data.map(e => {
      const timeStr = new Date(e.timestamp).toLocaleTimeString();
      let summary = e.eventType;
      if (e.payload?.holderName) summary += ` (${e.payload.holderName})`;
      else if (e.payload?.plateNumber) summary += ` [Plate: ${e.payload.plateNumber}]`;
      else if (e.payload?.distanceCm) summary += ` [Obstacle: ${e.payload.distanceCm}cm]`;
      else if (e.payload?.failureReason) summary += ` [${e.payload.failureReason}]`;

      return `
        <div class="event-entry ${e.severity}">
          <div>
            <strong style="color: ${e.severity === 'CRITICAL' ? '#fb7185' : e.severity === 'WARN' ? '#fbbf24' : '#93c5fd'};">
              [${e.severity}]
            </strong>
            <span style="margin-left: 0.5rem; font-weight: 500;">${summary}</span>
            <small style="margin-left: 0.5rem; color: var(--text-dim);">via ${e.sensorId}</small>
          </div>
          <span style="font-size: 0.75rem; color: var(--text-muted);">${timeStr}</span>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.warn('Events fetch error:', err);
  }
}

// Wire up Buttons and Modal Events
function setupEventListeners() {
  // Gate Control Buttons
  document.getElementById('btn-open-gate').addEventListener('click', () => sendCommand('OPEN'));
  document.getElementById('btn-close-gate').addEventListener('click', () => sendCommand('CLOSE'));
  document.getElementById('btn-lock-gate').addEventListener('click', () => sendCommand('LOCK'));
  document.getElementById('btn-unlock-gate').addEventListener('click', () => sendCommand('UNLOCK'));
  document.getElementById('btn-hold-gate').addEventListener('click', () => sendCommand('HOLD_OPEN'));
  document.getElementById('btn-stop-gate').addEventListener('click', () => sendCommand('STOP'));

  // Sound Siren Ring & Mute Controls
  const soundPill = document.getElementById('sound-status-pill');
  if (soundPill) soundPill.addEventListener('click', toggleSound);

  const btnSilence = document.getElementById('btn-silence-alarm');
  if (btnSilence) btnSilence.addEventListener('click', () => silenceAlarm(false));

  const btnTestChime = document.getElementById('btn-test-chime');
  if (btnTestChime) {
    btnTestChime.addEventListener('click', () => {
      playAccessChime();
      showSimFeedback('🔔 Playing Resident Access Chime.');
    });
  }

  const btnTestSiren = document.getElementById('btn-test-siren');
  if (btnTestSiren) {
    btnTestSiren.addEventListener('click', () => {
      triggerSecurityAlarm({
        details: 'Manual test of Security Siren Ring! Alert email dispatch ready for <strong>pg016742@gmail.com</strong>.'
      });
      showSimFeedback('🚨 Manual Security Alarm Siren Ring triggered!');
    });
  }

  // Simulation Triggers
  document.getElementById('sim-rfid-resident').addEventListener('click', () => triggerSimulation('RESIDENT_RFID'));
  document.getElementById('sim-alpr-vehicle').addEventListener('click', () => triggerSimulation('ALPR_VEHICLE'));
  document.getElementById('sim-rfid-denied').addEventListener('click', () => triggerSimulation('UNAUTHORIZED_RFID'));
  const btnPersonDenied = document.getElementById('sim-person-denied');
  if (btnPersonDenied) btnPersonDenied.addEventListener('click', () => triggerSimulation('UNAUTHORIZED_PERSON'));
  const btnAlprDenied = document.getElementById('sim-alpr-denied');
  if (btnAlprDenied) btnAlprDenied.addEventListener('click', () => triggerSimulation('UNAUTHORIZED_ALPR'));
  document.getElementById('sim-obstacle').addEventListener('click', () => triggerSimulation('SAFETY_OBSTACLE'));
  const btnSimCycle = document.getElementById('sim-gate-cycle');
  if (btnSimCycle) btnSimCycle.addEventListener('click', () => triggerSimulation('GATE_OPEN_CYCLE'));
  const btnSimHold = document.getElementById('sim-hold-open');
  if (btnSimHold) btnSimHold.addEventListener('click', () => triggerSimulation('GATE_HOLD_OPEN'));
  document.getElementById('sim-tamper').addEventListener('click', () => triggerSimulation('TAMPER_ALARM'));

  // Continuous Telemetry Triggers (Both FULLY_CLOSED and FULLY_OPEN)
  const btnGenClosed = document.getElementById('btn-gen-closed-telemetry');
  if (btnGenClosed) {
    btnGenClosed.addEventListener('click', async () => {
      showSimFeedback('Generating instantaneous FULLY_CLOSED telemetry sample...');
      try {
        const res = await fetch('/api/sensors/generate-telemetry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ restingState: 'FULLY_CLOSED', status: 'IDLE_CLOSED' })
        });
        const json = await res.json();
        if (json.success) {
          showSimFeedback('✓ FULLY_CLOSED telemetry sample generated and persisted to MongoDB!');
          fetchGateStatus();
          fetchEvents();
        } else {
          showSimFeedback(`✗ Error: ${json.error}`);
        }
      } catch (err) {
        showSimFeedback(`✗ Error: ${err.message}`);
      }
    });
  }

  const btnGenOpen = document.getElementById('btn-gen-open-telemetry');
  if (btnGenOpen) {
    btnGenOpen.addEventListener('click', async () => {
      showSimFeedback('Generating instantaneous FULLY_OPEN telemetry sample...');
      try {
        const res = await fetch('/api/sensors/generate-telemetry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ restingState: 'FULLY_OPEN', status: 'OPEN' })
        });
        const json = await res.json();
        if (json.success) {
          showSimFeedback('✓ FULLY_OPEN telemetry sample generated and persisted to MongoDB!');
          fetchGateStatus();
          fetchEvents();
        } else {
          showSimFeedback(`✗ Error: ${json.error}`);
        }
      } catch (err) {
        showSimFeedback(`✗ Error: ${err.message}`);
      }
    });
  }

  const btnGen5Min = document.getElementById('btn-gen-5min-telemetry');
  if (btnGen5Min) {
    btnGen5Min.addEventListener('click', async () => {
      showSimFeedback('Generating instantaneous interval telemetry point...');
      try {
        const res = await fetch('/api/sensors/generate-telemetry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        const json = await res.json();
        if (json.success) {
          showSimFeedback(`✓ Telemetry point (${json.restingState || 'Sample'}) generated and persisted to MongoDB!`);
          fetchGateStatus();
          fetchEvents();
        } else {
          showSimFeedback(`✗ Error: ${json.error}`);
        }
      } catch (err) {
        showSimFeedback(`✗ Error: ${err.message}`);
      }
    });
  }

  // Cluster refresh
  document.getElementById('btn-refresh-cluster').addEventListener('click', () => {
    fetchClusterStatus();
    showSimFeedback('Refreshed MongoDB Replica Set status.');
  });

  // Modal handlers
  const modal = document.getElementById('add-policy-modal');
  document.getElementById('btn-open-add-policy').addEventListener('click', () => modal.classList.add('active'));
  document.getElementById('btn-close-modal').addEventListener('click', () => modal.classList.remove('active'));
  document.getElementById('btn-cancel-modal').addEventListener('click', () => modal.classList.remove('active'));
  document.getElementById('add-policy-form').addEventListener('submit', handleCreatePolicy);

  // Event Feed Filters
  document.getElementById('filter-all').addEventListener('click', () => { eventFilter = 'ALL'; fetchEvents(); });
  document.getElementById('filter-security').addEventListener('click', () => { eventFilter = 'SECURITY'; fetchEvents(); });
  document.getElementById('filter-safety').addEventListener('click', () => { eventFilter = 'SAFETY'; fetchEvents(); });

  // Authorized Test Email Button
  const btnTestEmail = document.getElementById('btn-test-email');
  if (btnTestEmail) {
    btnTestEmail.addEventListener('click', async () => {
      btnTestEmail.disabled = true;
      btnTestEmail.textContent = 'Sending...';
      try {
        const res = await fetch('/api/notifications/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'pg016742@gmail.com', holderName: 'Pramod (Resident)', userRole: 'RESIDENT' })
        });
        const data = await res.json();
        if (data.success) {
          playAccessChime();
          showSimFeedback(`✓ Authorized test email dispatched to ${data.data.recipient}!`);
          fetchNotifications();
        }
      } catch (err) {
        alert(`Test email error: ${err.message}`);
      } finally {
        btnTestEmail.disabled = false;
        btnTestEmail.textContent = '✉ Test Authorized Email';
      }
    });
  }

  // Unauthorized Test Security Alert Button
  const btnTestUnauthorized = document.getElementById('btn-test-unauthorized-email');
  if (btnTestUnauthorized) {
    btnTestUnauthorized.addEventListener('click', async () => {
      btnTestUnauthorized.disabled = true;
      btnTestUnauthorized.textContent = 'Sending Alert...';
      try {
        const res = await fetch('/api/notifications/test-unauthorized', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'pg016742@gmail.com', identifier: 'UNKNOWN-INTRUDER-99', credentialType: 'RFID_TAG' })
        });
        const data = await res.json();
        if (data.success) {
          triggerSecurityAlarm({
            details: `Unauthorized security alert dispatched to <strong>${data.data.recipient}</strong>! Unknown intruder denied access.`,
            previewUrl: data.data.previewUrl
          });
          showSimFeedback(`🚨 Unauthorized security alert email dispatched to ${data.data.recipient}!`);
          fetchNotifications();
        }
      } catch (err) {
        alert(`Test alert error: ${err.message}`);
      } finally {
        btnTestUnauthorized.disabled = false;
        btnTestUnauthorized.textContent = '🚨 Test Unauthorized Alert';
      }
    });
  }
}

// Fetch and Render Live Email Notifications Feed
async function fetchNotifications() {
  const container = document.getElementById('notifications-stream-list');
  if (!container) return;
  try {
    const res = await fetch('/api/notifications');
    const json = await res.json();
    if (!json.success || !json.data) return;

    if (json.data.length === 0) {
      container.innerHTML = '<div style="padding: 0.75rem; color: var(--text-muted); text-align: center;">No email notifications dispatched yet. Present an authorized RFID tag or simulate an unauthorized attempt to trigger one.</div>';
      return;
    }

    // Auto-detect fresh incoming Security Alerts
    const latest = json.data[0];
    if (latest) {
      const isSecurityAlert = latest.type === 'UNAUTHORIZED_ATTEMPT' || latest.status === 'SECURITY_ALERT';
      const notifTime = new Date(latest.timestamp).getTime();
      if (isSecurityAlert && notifTime > lastAlertTimestamp && (Date.now() - notifTime) < 15000) {
        lastAlertTimestamp = notifTime;
        triggerSecurityAlarm({
          details: `Security Alert: ${latest.holderName || 'Unauthorized Person'} (${latest.identifier || 'Unknown'}). Dispatched to <strong>${latest.recipient}</strong>.`,
          previewUrl: latest.previewUrl
        });
      }
    }

    container.innerHTML = json.data.slice(0, 10).map(n => {
      const timeStr = new Date(n.timestamp).toLocaleTimeString();
      const isSecurityAlert = n.type === 'UNAUTHORIZED_ATTEMPT' || n.status === 'SECURITY_ALERT';
      const borderCol = isSecurityAlert ? '#ef4444' : '#06b6d4';
      const titleCol = isSecurityAlert ? '#f87171' : '#38bdf8';
      const badgeIcon = isSecurityAlert ? '🚨 [SECURITY ALERT]' : '📧 [ACCESS GRANTED]';
      const statusBadge = isSecurityAlert
        ? '<span style="color: #ef4444; font-weight: 700;">DENIED & ALERTED</span>'
        : '<span style="color: #34d399; font-weight: 600;">DELIVERED</span>';

      return `
        <div class="event-entry ${isSecurityAlert ? 'WARN' : 'INFO'}" style="border-left: 3px solid ${borderCol}; margin-bottom: 0.4rem; padding: 0.5rem 0.75rem; background: ${isSecurityAlert ? 'rgba(239, 68, 68, 0.06)' : 'rgba(6, 182, 212, 0.03)'};">
          <div style="flex: 1;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: ${titleCol};">${badgeIcon}</strong>
                <span style="margin-left: 0.4rem; font-weight: 500; color: ${isSecurityAlert ? '#fca5a5' : '#f8fafc'};">${n.holderName || 'Unauthorized Person'}</span>
                <span class="role-badge role-${n.userRole || 'INTRUDER'}" style="font-size: 0.65rem; padding: 0.1rem 0.4rem; margin-left: 0.3rem; background: ${isSecurityAlert ? 'rgba(239, 68, 68, 0.2)' : 'rgba(56, 189, 248, 0.2)'}; color: ${isSecurityAlert ? '#fca5a5' : '#38bdf8'};">${n.userRole || 'ALERT'}</span>
              </div>
              <span style="font-size: 0.75rem; color: var(--text-muted);">${timeStr}</span>
            </div>
            <div style="font-size: 0.75rem; color: #cbd5e1; margin-top: 0.25rem;">
              Alert Sent To: <span style="color: #a78bfa; font-family: monospace;">${n.recipient}</span>
            </div>
            <div style="font-size: 0.7rem; color: var(--text-dim); margin-top: 0.15rem;">
              Credential: <strong>${n.credentialType}</strong> (${n.identifier}) | Status: ${statusBadge} ${n.reason ? `| Reason: <span style="color: #fbbf24;">${n.reason}</span>` : ''}
            </div>
            ${n.previewUrl ? `
            <div style="margin-top: 0.35rem;">
              <a href="${n.previewUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; font-size: 0.72rem; font-weight: 500; padding: 0.2rem 0.65rem; border-radius: 4px; background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); text-decoration: none;">
                🔗 View Dispatched Email in Webmail Viewer ↗
              </a>
            </div>` : ''}
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.warn('Notifications fetch error:', err);
  }
}
