const router  = require('express').Router();
const { v4: uuid } = require('uuid');
const axios  = require('axios');
const NRF    = 'http://10.100.200.4:8000';
const UDM    = 'http://10.100.200.8:8000';
const UDR    = 'http://10.100.200.12:8000';
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

async function getSupiFromPhone(phone) {
  const msisdn = `msisdn-${phone.replace(/\D/g, '').slice(-10)}`;
  const token  = await getNRFToken('UDM', 'nudm-sdm');
  const r = await axios.get(
    `${UDM}/nudm-sdm/v2/${msisdn}/id-translation-result`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return r.data.supi;
}

// Endpoint pour lire le profil QoS d'un abonné
router.get('/v1/profiles/:phoneNumber', async (req, res) => {
  const { phoneNumber } = req.params;

  try {
    const supi  = await getSupiFromPhone(phoneNumber);
    const token = await getNRFToken('UDR', 'nudr-dr');

    const r = await axios.get(
      `${UDR}/nudr-dr/v2/subscription-data/${supi}/20893/provisioned-data/sm-data`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (r.data && Array.isArray(r.data) && r.data.length > 0) {
      const dnnConfigs = r.data[0].dnnConfigurations || {};
      const internet   = dnnConfigs.internet || {};
      const fiveQI     = internet['5gQosProfile']?.['5qi'] || 9;

      return res.json({
        phoneNumber,
        supi,
        '5qi': fiveQI,
      });
    }

    res.json({ phoneNumber, supi, '5qi': 9 });

  } catch(e) {
    console.error('[QoD Profiles] Erreur :', e.message);
    res.json({ phoneNumber, '5qi': 9 });
  }
});
