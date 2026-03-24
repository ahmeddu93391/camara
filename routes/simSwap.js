const router    = require('express').Router();
const axios     = require('axios');
const SIM_SWAPS = require('../data/simswaps');

const NRF    = 'http://10.100.200.4:8000';
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

async function getSupiFromPhone(phone) {
  const msisdn = `msisdn-${phone.replace(/\D/g, '').slice(-10)}`;
  const token  = await getNRFToken('UDM', 'nudm-sdm');
  const r = await axios.get(
    `${UDM}/nudm-sdm/v2/${msisdn}/id-translation-result`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return r.data.supi;
}

router.post('/v1/check', async (req, res) => {
  const { phoneNumber, maxAge = 24 } = req.body;

  if (!phoneNumber)
    return res.status(400).json({ status: 400, code: 'INVALID_ARGUMENT', message: 'phoneNumber requis' });
  if (maxAge > 240)
    return res.status(400).json({ status: 400, code: 'OUT_OF_RANGE', message: 'maxAge max 240h' });

  try {
    const supi  = await getSupiFromPhone(phoneNumber);
    const msisdn = `msisdn-${phoneNumber.replace(/\D/g, '').slice(-10)}`;

    const swapDate = SIM_SWAPS[msisdn];
    let swapped = false;

    if (swapDate) {
      const heuresEcoulees = (Date.now() - new Date(swapDate).getTime()) / (1000 * 3600);
      swapped = heuresEcoulees <= maxAge;
    }

    res.json({
      swapped,
      swapDate: swapDate || null,
      source: 'free5gc-udr',
      supi,
      checkedAt: new Date().toISOString()
    });

  } catch(e) {
    console.error('[SIM Swap v1] Erreur :', e.response ? e.response.data : e.message);
    res.json({ swapped: false, source: 'free5gc-udr', checkedAt: new Date().toISOString() });
  }
});

module.exports = router;
