const axios = require('axios');
const WEBUI = 'http://localhost:5000';

async function getToken() {
  const r = await axios.post(`${WEBUI}/api/login`, {
    username: 'admin', password: 'free5gc'
  });
  return r.data.access_token;
}

async function simulerSimSwap(imsi) {
  const token = await getToken();
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

  console.log(`SIM Swap simulé pour : ${imsi}`);
}

async function main() {
  console.log('=== Simulation de fraudes ===\n');
  console.log('Simulation SIM Swap...');
  await simulerSimSwap('imsi-208930000000002'); // vidéo temps réel
  await simulerSimSwap('imsi-208930000000004'); // navigation web

  console.log('\nSIM Swap simulé pour imsi-208930000000002 et imsi-208930000000004');
  console.log('Les autres abonnés (001, 003, 005) sont normaux\n');

  console.log('Scenario de fraude :');
  console.log('  0900000001 → SIM normale → LOW risk');
  console.log('  0900000002 → SIM changee recemment → HIGH risk');
  console.log('  0900000003 → SIM normale → LOW risk');
  console.log('  0900000004 → SIM changee recemment → HIGH risk');
  console.log('  0900000005 → SIM normale → LOW risk');
}

main().catch(e => console.error('Erreur :', e.response ? e.response.data : e.message));
