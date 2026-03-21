const router = require('express').Router();
const axios  = require('axios');

const NRF    = 'http://10.100.200.4:8000';
const AMF    = 'http://10.100.200.16:8000';
const AF_ID  = '06738def-a5b1-4948-a1aa-93650d8ddf82';

async function getNRFToken() {
  const r = await axios.post(
    `${NRF}/oauth2/token`,
    new URLSearchParams({
      grant_type: 'client_credentials',
      nfInstanceId: AF_ID,
      nfType: 'AF',
      targetNfType: 'AMF',
      scope: 'namf-oam',
      requesterPlmn: '{"mcc":"208","mnc":"93"}'
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return r.data.access_token;
}

function phoneToSupi(phone) {
  const digits = phone.replace(/\D/g, '').slice(-9);
  return `imsi-20893${digits.padStart(10, '0')}`;
}

// Location Verification v3
router.post('/v3/verify', async (req, res) => {
  const { device, area } = req.body;

  if (!device?.phoneNumber || !area)
    return res.status(400).json({ status: 400, code: 'INVALID_ARGUMENT', message: 'device et area requis' });

  try {
    const supi     = phoneToSupi(device.phoneNumber);
    const token    = await getNRFToken();
    const amfData  = await axios.get(
      `${AMF}/namf-oam/v1/registered-ue-context`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const ueList    = amfData.data || [];
    const connected = Array.isArray(ueList)
      ? ueList.some(ue => ue.supi === supi)
      : false;

    res.status(422).json({
      status: 422,
      code: 'LOCATION_VERIFICATION.UNABLE_TO_LOCATE',
      message: connected
        ? 'Terminal connecté mais localisation GPS non disponible'
        : 'Terminal non connecté au réseau',
      source: 'free5gc-amf'
    });

  } catch(e) {
    console.error('[Location] Erreur :', e.response ? e.response.data : e.message);
    res.status(422).json({
      status: 422,
      code: 'LOCATION_VERIFICATION.UNABLE_TO_LOCATE',
      message: 'Erreur APIs internes',
      source: 'free5gc-amf'
    });
  }
});

// Location Retrieval
router.post('/retrieve', async (req, res) => {
  res.status(422).json({
    status: 422,
    code: 'LOCATION_RETRIEVAL.UNABLE_TO_LOCATE',
    message: 'Localisation GPS non supportée par free5GC'
  });
});

module.exports = router;
