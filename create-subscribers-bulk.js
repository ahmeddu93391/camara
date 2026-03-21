const axios = require('axios');
const WEBUI = 'http://localhost:5000';

// Configuration
const CONFIG = {
  nombre: 10, // nombre d'abonnés à créer
  imsiBase: 'imsi-20893000000',  // base IMSI
  msisdnBase: '090000', // base numéro téléphone
  plmnID: '20893',
  uplink: '1 Gbps',
  downlink: '2 Gbps'
};

async function getToken() {
  const r = await axios.post(`${WEBUI}/api/login`, {
    username: 'admin',
    password: 'free5gc'
  });
  return r.data.access_token;
}

async function createSubscriber(token, index) {
  // Générer IMSI et numéro uniques
  const imsi = `${CONFIG.imsiBase}${String(index).padStart(4, '0')}`;
  const msisdn = `${CONFIG.msisdnBase}${String(index).padStart(4, '0')}`;

  try {
    await axios.post(
      `${WEBUI}/api/subscriber/${imsi}/${CONFIG.plmnID}`,
      {
        plmnID: CONFIG.plmnID,
        ueId: imsi,
        AuthenticationSubscription: {
          authenticationMethod: '5G_AKA',
          permanentKey: {
            permanentKeyValue: '8baf473f2f8fd09487cccbd7097c6862',
            encryptionKey: 0,
            encryptionAlgorithm: 0
          },
          sequenceNumber: '16f3b3f70fc2',
          authenticationManagementField: '8000',
          opc: {
            opcValue: '8e27b6af0e692e750f32667a3b14605d',
            encryptionKey: 0,
            encryptionAlgorithm: 0
          }
        },
        AccessAndMobilitySubscriptionData: {
          gpsis: [`msisdn-${msisdn}`],
          subscribedUeAmbr: {
            uplink: CONFIG.uplink,
            downlink: CONFIG.downlink
          },
          nssai: {
            defaultSingleNssais: [{ sst: 1, sd: '010203' }]
          }
        }
      },
      { headers: { Token: token } }
    );
    console.log(`Créé : ${imsi} — numéro : ${msisdn}`);
  } catch(e) {
    console.error(`Erreur ${imsi} :`, e.response ? e.response.data : e.message);
  }
}

async function main() {
  console.log(`Création de ${CONFIG.nombre} abonnés...\n`);

  const token = await getToken();

  for (let i = 1; i <= CONFIG.nombre; i++) {
    await createSubscriber(token, i);
  }

  // Vérifier le total
  const subs = await axios.get(`${WEBUI}/api/subscriber`, {
    headers: { Token: token }
  });
  console.log(`\nTotal abonnés dans free5GC : ${subs.data.length}`);
  console.log(JSON.stringify(subs.data, null, 2));
}

main().catch(e => console.error('Erreur globale :', e.message));
