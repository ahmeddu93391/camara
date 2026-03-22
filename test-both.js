const axios = require('axios');
const BASE  = 'http://localhost:3000';
const PHONE = '0900000000';

async function main() {
  const r = await axios.post(`${BASE}/oauth/token`,
    'grant_type=client_credentials&client_id=test&client_secret=test',
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  const headers = { Authorization: `Bearer ${r.data.access_token}`, 'Content-Type': 'application/json' };

  // ── WebUI ─────────────────────────────────────────────────
  console.log('\n=== SIM Swap (WebUI) ===');
  const s0 = await axios.post(`${BASE}/webui/sim-swap/v0/check`,
    { phoneNumber: PHONE, maxAge: 24 }, { headers });
  console.log(s0.data);

  console.log('\n=== Device Status (WebUI) ===');
  const d0 = await axios.post(`${BASE}/webui/device-reachability-status/v0/retrieve`,
    { device: { phoneNumber: PHONE } }, { headers });
  console.log(d0.data);

  console.log('\n=== Location (WebUI) ===');
  const l0 = await axios.post(`${BASE}/webui/location-verification/v0/verify`,
    { device: { phoneNumber: PHONE }, area: { areaType: 'CIRCLE', center: { latitude: 48.8566, longitude: 2.3522 }, radius: 1000 } },
    { headers }
  ).catch(e => e.response);
  console.log(l0.data);

  // ── APIs internes ─────────────────────────────────────────
  console.log('\n=== SIM Swap (APIs internes) ===');
  const s1 = await axios.post(`${BASE}/sim-swap/v1/check`,
    { phoneNumber: PHONE, maxAge: 24 }, { headers });
  console.log(s1.data);

  console.log('\n=== Device Status (APIs internes) ===');
  const d1 = await axios.post(`${BASE}/device-reachability-status/v1/retrieve`,
    { device: { phoneNumber: PHONE } }, { headers });
  console.log(d1.data);

  console.log('\n=== Location (APIs internes) ===');
  const l1 = await axios.post(`${BASE}/location-verification/v3/verify`,
    { device: { phoneNumber: PHONE }, area: { areaType: 'CIRCLE', center: { latitude: 48.8566, longitude: 2.3522 }, radius: 1000 } },
    { headers }
  ).catch(e => e.response);
  console.log(l1.data);

  // ── QoD ───────────────────────────────────────────────────
  console.log('\n=== Quality on Demand ===');
  const q = await axios.post(`${BASE}/quality-on-demand/v1/sessions`,
    { device: { phoneNumber: PHONE }, qosProfile: 'QOS_L', duration: 3600 },
    { headers }
  );
  console.log(q.data);

  await axios.delete(`${BASE}/quality-on-demand/v1/sessions/${q.data.sessionId}`, { headers });
  console.log('Session QoD supprimée OK');
}

main().catch(e => console.error('Erreur :', e.response ? e.response.data : e.message));
