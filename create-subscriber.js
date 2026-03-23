const axios = require('axios');
const WEBUI = 'http://localhost:5000';

async function getToken() {
  const r = await axios.post(`${WEBUI}/api/login`, {
    username: 'admin', password: 'free5gc'
  });
  return r.data.access_token;
}

async function creerAbonne(imsi, msisdn, fiveQI, priorite, description) {
  const token = await getToken();

  // Supprimer si existe déjà
  try {
    await axios.delete(
      `${WEBUI}/api/subscriber/${imsi}/20893`,
      { headers: { Token: token } }
    );
    console.log(`Supprimé : ${imsi}`);
  } catch(e) {}

  await axios.post(
    `${WEBUI}/api/subscriber/${imsi}/20893`,
    {
      plmnID: '20893',
      ueId: imsi,
      AuthenticationSubscription: {
        authenticationMethod: '5G_AKA',
        permanentKey: {
          permanentKeyValue: '8baf473f2f8fd09487cccbd7097c6862',
          encryptionKey: 0, encryptionAlgorithm: 0
        },
        sequenceNumber: '16f3b3f70fc2',
        authenticationManagementField: '8000',
        opc: {
          opcValue: '8e27b6af0e692e750f32667a3b14605d',
          encryptionKey: 0, encryptionAlgorithm: 0
        }
      },
      AccessAndMobilitySubscriptionData: {
        gpsis: [`msisdn-${msisdn}`],
        subscribedUeAmbr: { uplink: '1 Gbps', downlink: '2 Gbps' },
        nssai: { defaultSingleNssais: [{ sst: 1, sd: '010203' }] }
      },
      SessionManagementSubscriptionData: [{
        singleNssai: { sst: 1, sd: '010203' },
        dnnConfigurations: {
          internet: {
            pduSessionTypes: { defaultSessionType: 'IPV4' },
            sscModes: { defaultSscMode: 'SSC_MODE_1' },
            '5gQosProfile': {
              '5qi': fiveQI,
              arp: { priorityLevel: priorite, preemptCap: 'NOT_PREEMPT', preemptVuln: 'NOT_PREEMPTABLE' }
            },
            sessionAmbr: { uplink: '1000 Mbps', downlink: '1000 Mbps' }
          }
        }
      }]
    },
    { headers: { Token: token } }
  );

  console.log(`Créé : ${imsi} | ${msisdn} | 5QI=${fiveQI} | ${description}`);
}

async function main() {
  console.log('Création des abonnés avec profils QoS...\n');

  await creerAbonne('imsi-208930000000001', '0900000001', 1, 1, 'Visioconférence médicale (QOS_E)');
  await creerAbonne('imsi-208930000000002', '0900000002', 2, 2, 'Vidéo temps réel (QOS_E)');
  await creerAbonne('imsi-208930000000003', '0900000003', 4, 4, 'Jeu en ligne (QOS_L)');
  await creerAbonne('imsi-208930000000004', '0900000004', 9, 8, 'Navigation web (QOS_M)');
  await creerAbonne('imsi-208930000000005', '0900000005', 8, 9, 'Téléchargement (QOS_S)');

  console.log('\nVérification des abonnés créés...');
  const token = await getToken();
  const subs  = await axios.get(`${WEBUI}/api/subscriber`, { headers: { Token: token } });
  console.log(`Total : ${subs.data.length} abonnés`);
  subs.data.forEach(s => console.log(`  - ${s.ueId} | ${s.gpsi}`));
}

main().catch(e => console.error('Erreur :', e.response ? e.response.data : e.message));
