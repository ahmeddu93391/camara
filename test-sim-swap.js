const axios = require('axios');
const BASE = 'http://localhost:3000';

async function main() {
  const r = await axios.post(`${BASE}/oauth/token`,
    'grant_type=client_credentials&client_id=test&client_secret=test',
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  const headers = { Authorization: `Bearer ${r.data.access_token}`, 'Content-Type': 'application/json' };
  const res1 = await axios.post(`${BASE}/sim-swap/v1/check`,
    { phoneNumber: '0900000000', maxAge: 24 }, { headers }
  );
  console.log('SIM Swap APIs internes :', res1.data);
}

main().catch(e => console.error('Erreur :', e.response ? e.response.data : e.message));
