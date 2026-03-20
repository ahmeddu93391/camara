const axios = require('axios');
const BASE = 'http://localhost:3000';

async function main() {
  const r = await axios.post(`${BASE}/oauth/token`,
    'grant_type=client_credentials&client_id=test&client_secret=test',
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  const headers = { Authorization: `Bearer ${r.data.access_token}`, 'Content-Type': 'application/json' };

  // Créer session
  const create = await axios.post(`${BASE}/quality-on-demand/v1/sessions`,
    { device: { phoneNumber: '0900000000' }, qosProfile: 'QOS_L', duration: 3600 },
    { headers }
  );
  console.log('Session créée :', create.data);

  // Vérifier session
  const get = await axios.get(`${BASE}/quality-on-demand/v1/sessions/${create.data.sessionId}`, { headers });
  console.log('Session vérifiée :', get.data);

  // Supprimer session
  await axios.delete(`${BASE}/quality-on-demand/v1/sessions/${create.data.sessionId}`, { headers });
  console.log('Session supprimée OK');
}

main().catch(e => console.error('Erreur :', e.response ? e.response.data : e.message));
