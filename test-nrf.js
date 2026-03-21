const axios = require('axios');

const NRF = 'http://10.100.200.4:8000';
const UDM = 'http://10.100.200.8:8000';
const AMF = 'http://10.100.200.16:8000';
const UDR = 'http://10.100.200.12:8000';
const NEF_ID = '9dea0e89-3b26-4b74-9159-5a01ffce1127';
const AF_ID  = '06738def-a5b1-4948-a1aa-93650d8ddf82';
const SUPI   = 'imsi-208930000000001';

async function getToken(nfType, targetNfType, scope, nfInstanceId) {
  const r = await axios.post(
    `${NRF}/oauth2/token`,
    new URLSearchParams({
      grant_type: 'client_credentials',
      nfInstanceId,
      nfType,
      targetNfType,
      scope,
      requesterPlmn: '{"mcc":"208","mnc":"93"}'
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return r.data.access_token;
}

async function main() {

  // Test 1 — UDM v2 — données abonné
  console.log('\n=== Test UDM v2 ===');
  try {
    const token = await getToken('NEF', 'UDM', 'nudm-sdm', NEF_ID);
    const r = await axios.get(
      `${UDM}/nudm-sdm/v2/${SUPI}/nssai?plmn-id={"mcc":"208","mnc":"93"}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log('UDM répond :', r.data);
  } catch(e) {
    console.log('UDM erreur :', e.response ? e.response.data : e.message);
  }

  // Test 2 — UDR v2 — historique SIM
  console.log('\n=== Test UDR v2 ===');
  try {
    const token = await getToken('NEF', 'UDR', 'nudr-dr', NEF_ID);
    const r = await axios.get(
      `${UDR}/nudr-dr/v2/subscription-data/${SUPI}/authentication-data/authentication-subscription`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log('UDR répond :', JSON.stringify(r.data).substring(0, 200));
  } catch(e) {
    console.log('UDR erreur :', e.response ? e.response.data : e.message);
  }

  // Test 3 — AMF OAM — terminaux connectés
  console.log('\n=== Test AMF OAM ===');
  try {
    const token = await getToken('AF', 'AMF', 'namf-oam', AF_ID);
    const r = await axios.get(
      `${AMF}/namf-oam/v1/registered-ue-context`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log('AMF répond :', JSON.stringify(r.data).substring(0, 200));
  } catch(e) {
    console.log('AMF erreur :', e.response ? e.response.data : e.message);
  }

  // Test 4 — UDR provisioned data
  console.log('\n=== Test UDR provisioned data ===');
  try {
    const token = await getToken('NEF', 'UDR', 'nudr-dr', NEF_ID);
    const r = await axios.get(
      `${UDR}/nudr-dr/v2/subscription-data/${SUPI}/20893/provisioned-data/am-data?supported-features=`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log('UDR provisioned répond :', JSON.stringify(r.data).substring(0, 200));
  } catch(e) {
    console.log('UDR provisioned erreur :', e.response ? e.response.data : e.message);
  }
}

main().catch(e => console.error('Erreur globale :', e.message));
