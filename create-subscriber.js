const axios = require('axios');
const { execSync } = require('child_process');
const fs = require('fs');

const WEBUI = 'http://localhost:5000';

const PROFILS = [
  { fiveQI: 1, priorite: 1, description: 'Voix temps réel (QOS_E)' },
  { fiveQI: 2, priorite: 2, description: 'Vidéo temps réel (QOS_E)' },
  { fiveQI: 4, priorite: 4, description: 'Jeu en ligne (QOS_L)' },
  { fiveQI: 9, priorite: 8, description: 'Navigation web (QOS_M)' },
  { fiveQI: 8, priorite: 9, description: 'Téléchargement (QOS_S)' },
];

async function getToken() {
  const r = await axios.post(`${WEBUI}/api/login`, {
    username: 'admin', password: 'free5gc'
  });
  return r.data.access_token;
}

async function getNextNumero(token) {
  const subs = await axios.get(`${WEBUI}/api/subscriber`, {
    headers: { Token: token }
  });

  let maxNum = 0;
  for (const s of subs.data) {
    const match = s.ueId.match(/imsi-20893(\d+)/);
    if (match) {
      const num = parseInt(match[1]);
      if (num > maxNum) maxNum = num;
    }
  }

  return maxNum + 1;
}

function genererConfigUERANSIM(numero, imsi) {
  return `supi: "${imsi}"
mcc: "208"
mnc: "93"
key: "8baf473f2f8fd09487cccbd7097c6862"
op: "8e27b6af0e692e750f32667a3b14605d"
opType: "OPC"
amf: "8000"
imei: "35693803564380${numero}"
imeiSv: "43708161258161${numero}"
gnbSearchList:
  - 127.0.0.1
uacAic:
  mps: false
  mcs: false
uacAcc:
  normalClass: 0
  class11: false
  class12: false
  class13: false
  class14: false
  class15: false
sessions:
  - type: "IPv4"
    apn: "internet"
    slice:
      sst: 0x01
      sd: 0x010203
configured-nssai:
  - sst: 0x01
    sd: 0x010203
default-nssai:
  - sst: 1
    sd: 1
integrity:
  IA1: true
  IA2: true
  IA3: true
ciphering:
  EA1: true
  EA2: true
  EA3: true
integrityMaxRate:
  uplink: "full"
  downlink: "full"
`;
}

async function creerEtConnecterAbonne() {
  const token = await getToken();

  const numero = await getNextNumero(token);
  const imsi   = `imsi-20893${String(numero).padStart(10, '0')}`;
  const msisdn = `090000000${numero}`;

  const profil = PROFILS[Math.floor(Math.random() * PROFILS.length)];
  console.log('='.repeat(55));
  console.log('Création du nouvel abonné');
  console.log('='.repeat(55));
  console.log(`IMSI    : ${imsi}`);
  console.log(`Numéro  : ${msisdn}`);
  console.log(`Profil  : ${profil.description} (5QI=${profil.fiveQI})`);

  console.log('\n[1] Création dans free5GC...');
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
              '5qi': profil.fiveQI,
              arp: { priorityLevel: profil.priorite, preemptCap: 'NOT_PREEMPT', preemptVuln: 'NOT_PREEMPTABLE' }
            },
            sessionAmbr: { uplink: '1000 Mbps', downlink: '1000 Mbps' }
          }
        }
      }]
    },
    { headers: { Token: token } }
  );
  console.log(`    Abonné créé : ${imsi}`);

  console.log('\n[2] Génération config UERANSIM...');
  const configPath = `/tmp/ue${numero}.yaml`;
  const configContent = genererConfigUERANSIM(numero, imsi);

  fs.writeFileSync(`/tmp/ue${numero}_temp.yaml`, configContent);
  execSync(`docker cp /tmp/ue${numero}_temp.yaml ueransim:${configPath}`);
  fs.unlinkSync(`/tmp/ue${numero}_temp.yaml`);
  console.log(`Config copiée : ${configPath}`);

  console.log('\n[3] Connexion du terminal via UERANSIM...');
  const cmd = `docker exec -d ueransim bash -c "./nr-ue -c ${configPath} > /tmp/ue${numero}.log 2>&1"`;
  execSync(cmd);
  console.log(`Terminal lancé en arrière-plan`);

  console.log('\n[4] Vérification de la connexion (attente 5s)...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  const logs = execSync(`docker exec ueransim cat /tmp/ue${numero}.log 2>/dev/null || echo ""`).toString();
  if (logs.includes('Registration is successful')) {
    console.log('Terminal CONNECTED — Registration successful !');
  } else if (logs.includes('MM-REGISTERED')) {
    console.log('Terminal CONNECTED — MM-REGISTERED !');
  } else {
    console.log('En cours de connexion... vérifie avec :');
  }

  console.log('\n' + '='.repeat(55));
  console.log('RÉSUMÉ');
  console.log('='.repeat(55));
  console.log(`IMSI    : ${imsi}`);
  console.log(`Numéro  : ${msisdn}`);
  console.log(`5QI     : ${profil.fiveQI}`);
  console.log(`Profil  : ${profil.description}`);
  console.log(`Config  : ${configPath}`);
}

creerEtConnecterAbonne().catch(e => console.error('Erreur :', e.response ? e.response.data : e.message));
