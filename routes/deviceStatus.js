const router = require('express').Router();
const axios  = require('axios');

const NRF    = 'http://10.100.200.4:8000';
const AMF    = 'http://10.100.200.16:8000';
const UDR    = 'http://10.100.200.12:8000';
const AF_ID  = '06738def-a5b1-4948-a1aa-93650d8ddf82';
const NEF_ID = '9dea0e89-3b26-4b74-9159-5a01ffce1127';

async function getNRFToken(nfType, targetNfType, scope, instanceId) {
  const r = await axios.post(
    `${NRF}/oauth2/token`,
    new URLSearchParams({
      grant_type: 'client_credentials',
      nfInstanceId: instanceId,
      nfType,
      targetNfType,
      scope,
      requesterPlmn: '{"mcc":"208","mnc":"93"}'
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return r.data.access_token;
}

function phoneToGpsi(phone) {
  const digits = phone.replace(/\D/g, '').slice(-10);
  return `msisdn-${digits}`;
}

router.post('/v1/retrieve', async (req, res) => {
  const phoneNumber = req.body.device?.phoneNumber;

  if (!phoneNumber)
    return res.status(400).json({ status: 400, code: 'INVALID_ARGUMENT', message: 'device.phoneNumber requis' });

  try {
    const supi = phoneToSupi(phoneNumber);

    // Vérifier abonné dans UDR
    const tokenUDR = await getNRFToken('NEF', 'UDR', 'nudr-dr', NEF_ID);
    await axios.get(
      `${UDR}/nudr-dr/v2/subscription-data/${supi}/20893/provisioned-data/am-data?supported-features=`,
      { headers: { Authorization: `Bearer ${tokenUDR}` } }
    );

    // Vérifier connexion via AMF
    const tokenAMF = await getNRFToken('AF', 'AMF', 'namf-oam', AF_ID);
    const amfData  = await axios.get(
      `${AMF}/namf-oam/v1/registered-ue-context`,
      { headers: { Authorization: `Bearer ${tokenAMF}` } }
    );

    const ueList    = amfData.data || [];
    const connected = Array.isArray(ueList)
      ? ueList.some(ue => 
        (ue.Supi === supi || ue.supi === supi) && 
        ue.CmState === 'CONNECTED'
        )
      : false;

    res.json({
      reachabilityStatus: connected ? 'REACHABLE' : 'UNREACHABLE',
      source: 'free5gc-amf',
      supi,
      checkedAt: new Date().toISOString()
    });

  } catch(e) {
    console.error('[Device Status] Erreur :', e.response ? e.response.data : e.message);
    res.json({ reachabilityStatus: 'UNREACHABLE', source: 'free5gc-amf', checkedAt: new Date().toISOString() });
  }
});

module.exports = router;
