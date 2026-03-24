const axios = require('axios');
const fs    = require('fs');
const path  = require('path');

const NRF    = 'http://10.100.200.4:8000';
const UDR    = 'http://10.100.200.12:8000';
const UDM    = 'http://10.100.200.8:8000';
const NEF_ID = '9dea0e89-3b26-4b74-9159-5a01ffce1127';

async function getNRFToken(targetNfType, scope) {
  const r = await axios.post(
    `${NRF}/oauth2/token`,
    new URLSearchParams({
      grant_type: 'client_credentials',
      nfInstanceId: NEF_ID,
      nfType: 'NEF',
      targetNfType,
      scope,
      requesterPlmn: '{"mcc":"208","mnc":"93"}'
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return r.data.access_token;
}

async function simulerSimSwap(supi) {
  const token = await getNRFToken('UDR', 'nudr-dr');

  await axios.patch(
    `${UDR}/nudr-dr/v2/subscription-data/${supi}/authentication-data/authentication-subscription`,
    [{ op: 'replace', path: '/encPermanentKey', value: 'ccddee00112233445566778899aabbcc' }],
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json-patch+json' } }
  );
  console.log(`SIM Swap simulé via UDR : ${supi}`);
}

async function main() {
  console.log('=== Simulation de fraudes via APIs internes ===\n');
  await simulerSimSwap('imsi-208930000000002');
  await simulerSimSwap('imsi-208930000000004');

  console.log('\n[2] Mise à jour du registre SIM Swaps...');
  const simswaps = {
    'msisdn-0900000002': new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    'msisdn-0900000004': new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
  };

  const content = `Registre des SIM Swaps
   ${new Date().toISOString()}

const SIM_SWAPS = ${JSON.stringify(simswaps, null, 2)};

module.exports = SIM_SWAPS;
`;

  fs.writeFileSync(path.join(__dirname, 'data', 'simswaps.js'), content);
  console.log('Registre mis à jour : data/simswaps.js');

  console.log('\n=== Scénarios configurés ===');
  console.log('  0900000001 → SIM normale        → LOW risk');
  console.log('  0900000002 → SIM swappée (2h)   → HIGH risk');
  console.log('  0900000003 → SIM normale        → LOW risk');
  console.log('  0900000004 → SIM swappée (5h)   → HIGH risk');
  console.log('  0900000005 → SIM normale        → LOW risk');
}

main().catch(e => console.error('Erreur :', e.response ? e.response.data : e.message));
