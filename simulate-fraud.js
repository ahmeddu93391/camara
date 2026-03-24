const axios = require('axios');
const fs    = require('fs');
const path  = require('path');

const WEBUI = 'http://localhost:5000';

async function getToken() {
  const r = await axios.post(`${WEBUI}/api/login`, {
    username: 'admin', password: 'free5gc'
  });
  return r.data.access_token;
}

async function simulerSimSwap(imsi) {
  const token  = await getToken();
  const detail = await axios.get(
    `${WEBUI}/api/subscriber/${imsi}/20893`,
    { headers: { Token: token } }
  );
  const data = detail.data;
  data.AuthenticationSubscription.permanentKey.permanentKeyValue = 'aabbccddeeff00112233445566778899';
  data.AuthenticationSubscription.sequenceNumber = '000000000001';
  await axios.put(
    `${WEBUI}/api/subscriber/${imsi}/20893`,
    data,
    { headers: { Token: token } }
  );
  console.log(`SIM Swap simulé dans free5GC : ${imsi}`);
}

async function main() {
  console.log('=== Simulation de fraudes ===\n');

  console.log('[1] Simulation SIM Swap dans free5GC...');
  await simulerSimSwap('imsi-208930000000002');
  await simulerSimSwap('imsi-208930000000004');

  // 2 — Mettre à jour le registre du mock CAMARA
  console.log('\n[2] Mise à jour du registre SIM Swaps...');
  const simswaps = {
    'msisdn-0900000002': new Date(Date.now() - 2 * 3600 * 1000).toISOString(),   // il y a 2h
    'msisdn-0900000004': new Date(Date.now() - 5 * 3600 * 1000).toISOString(),   // il y a 5h
  };

  const content = `// Registre des SIM Swaps simulés — généré par simulate-fraud.js
// Dernière mise à jour : ${new Date().toISOString()}

const SIM_SWAPS = ${JSON.stringify(simswaps, null, 2)};

module.exports = SIM_SWAPS;
`;

  fs.writeFileSync(path.join(__dirname, 'data', 'simswaps.js'), content);
  console.log('Registre mis à jour : data/simswaps.js');

  console.log('\n=== Scénarios de fraude configurés ===');
  console.log('  0900000001 → SIM normale        → LOW risk');
  console.log('  0900000002 → SIM swappée il y a 2h → HIGH risk');
  console.log('  0900000003 → SIM normale        → LOW risk');
  console.log('  0900000004 → SIM swappée il y a 5h → HIGH risk');
  console.log('  0900000005 → SIM normale        → LOW risk');
  console.log('\nN\'oublie pas de rebuilder le conteneur Docker !');
}

main().catch(e => console.error('Erreur :', e.response ? e.response.data : e.message));
