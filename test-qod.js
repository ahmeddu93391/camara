const axios = require('axios');

const CAMARA = 'http://localhost:3000';
const NRF    = 'http://10.100.200.4:8000';
const UDM    = 'http://10.100.200.8:8000';
const UDR    = 'http://10.100.200.12:8000';
const NEF_ID = '9dea0e89-3b26-4b74-9159-5a01ffce1127';

const CORRESPONDANCE_5QI = {
  1: { profil: 'QOS_E', description: 'Voix temps réel' },
  2: { profil: 'QOS_E', description: 'Vidéo temps réel' },
  3: { profil: 'QOS_E', description: 'Jeu temps réel' },
  4: { profil: 'QOS_L', description: 'Jeu en ligne' },
  5: { profil: 'QOS_L', description: 'IMS signalisation' },
  6: { profil: 'QOS_L', description: 'Streaming live' },
  7: { profil: 'QOS_L', description: 'Voix interactive' },
  8: { profil: 'QOS_S', description: 'Téléchargement' },
  9: { profil: 'QOS_M', description: 'Navigation web' },
};

async function obtenirTokenCamara() {
  const r = await axios.post(`${CAMARA}/oauth/token`,
    'grant_type=client_credentials&client_id=test&client_secret=test',
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return r.data.access_token;
}

async function obtenirTokenNrf(targetNfType, scope) {
  const r = await axios.post(`${NRF}/oauth2/token`,
    `grant_type=client_credentials&nfInstanceId=${NEF_ID}&nfType=NEF&targetNfType=${targetNfType}&scope=${scope}&requesterPlmn={"mcc":"208","mnc":"93"}`,
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return r.data.access_token;
}

async function obtenirSupi(numero) {
  const token = await obtenirTokenNrf('UDM', 'nudm-sdm');
  const r = await axios.get(`${UDM}/nudm-sdm/v2/msisdn-${numero}/id-translation-result`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return r.data.supi;
}

async function obtenir5Qi(numero) {
  try {
    const supi = await obtenirSupi(numero);
    if (!supi) return { fiveQi: 9, profil: 'QOS_M', description: 'Navigation web (défaut)' };

    const token = await obtenirTokenNrf('UDR', 'nudr-dr');
    const r = await axios.get(`${UDR}/nudr-dr/v2/subscription-data/${supi}/20893/provisioned-data/sm-data`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (r.status === 200 && Array.isArray(r.data) && r.data.length > 0) {
      const dnn = r.data[0].dnnConfigurations?.internet?.['5gQosProfile'];
      const fiveQi = dnn?.['5qi'] || 9;
      const info = CORRESPONDANCE_5QI[fiveQi] || { profil: 'QOS_M', description: 'Inconnu' };
      return { fiveQi, profil: info.profil, description: info.description };
    }
  } catch (e) {
    console.error('Erreur lecture 5QI :', e.message);
  }
  return { fiveQi: 9, profil: 'QOS_M', description: 'Navigation web (défaut)' };
}

async function creerSessionQos(numero, profil, duree = 3600) {
  const token = await obtenirTokenCamara();
  const r = await axios.post(`${CAMARA}/quality-on-demand/v1/sessions`,
    { device: { phoneNumber: numero }, qosProfile: profil, duration: duree },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
  return r.data;
}

async function supprimerSessionQos(sessionId) {
  const token = await obtenirTokenCamara();
  const r = await axios.delete(`${CAMARA}/quality-on-demand/v1/sessions/${sessionId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return r.status;
}


async function executerUC1(numero) {
  console.log(`\n============================================================`);
  console.log(`UC1 - Boost de Connectivité Intelligent`);
  console.log(`Terminal : ${numero}`);
  console.log(`============================================================`);

  const profil = await obtenir5Qi(numero);
  console.log(`[1] Profil CAMARA : 5QI=${profil.fiveQi} | Profil QoS=${profil.profil}`);

  const session = await creerSessionQos(numero, profil.profil);
  console.log(`[2] Session QoS créée : ID=${session.sessionId}, Statut=${session.status}, Expiration=${session.expiresAt}`);

  const sessionVerif = await axios.get(`${CAMARA}/quality-on-demand/v1/sessions/${session.sessionId}`,
    { headers: { Authorization: `Bearer ${await obtenirTokenCamara()}` } }
  );
  console.log(`[3] Session vérifiée :`, sessionVerif.data);

  const codeSupp = await supprimerSessionQos(session.sessionId);
  console.log(`[4] Session supprimée : HTTP ${codeSupp}`);

  console.log(`\n============================================================`);
  console.log(`RÉSULTAT FINAL : Décision ACTIVER, Profil QoS=${profil.profil}`);
  console.log(`============================================================`);
}


(async () => {
  const terminaux = ['0900000001','0900000002','0900000003','0900000004','0900000005'];
  for (const numero of terminaux) {
    await executerUC1(numero);
  }
})();
