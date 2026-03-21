const { getNRFToken } = require('./nrf-auth');

async function main() {
  console.log('Demande token au NRF...');

  // Test 1 — token pour UDM
  const tokenUDM = await getNRFToken('nudm-sdm');
  console.log('Token UDM :', tokenUDM ? tokenUDM.substring(0, 50) + '...' : 'ECHEC');

  // Test 2 — token pour AMF
  const tokenAMF = await getNRFToken('namf-comm');
  console.log('Token AMF :', tokenAMF ? tokenAMF.substring(0, 50) + '...' : 'ECHEC');

  // Test 3 — utiliser le token pour appeler l'UDM
  const axios = require('axios');
  console.log('\nAppel UDM avec token...');
  try {
    const r = await axios.get(
      'http://10.100.200.8:8000/nudm-sdm/v1/imsi-208930000000001/nssai',
      { headers: { Authorization: `Bearer ${tokenUDM}` } }
    );
    console.log('UDM répond :', r.data);
  } catch(e) {
    console.log('UDM erreur :', e.response ? e.response.data : e.message);
  }
}

main().catch(e => console.error('Erreur :', e.response ? e.response.data : e.message));
