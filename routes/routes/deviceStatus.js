const router = require('express').Router();
const axios  = require('axios');
const { FREE5GC } = require('../index');

router.post('/v0/retrieve', async (req, res) => {
  const phoneNumber = req.body.device?.phoneNumber;
  if (!phoneNumber)
    return res.status(400).json({ status: 400, code: 'INVALID_ARGUMENT', message: 'device.phoneNumber requis' });
  try {
    const supi = phoneToSupi(phoneNumber);
    const r = await axios.get(
      `${FREE5GC.amf}/namf-comm/v1/ue-contexts/${supi}`,
      { timeout: 3000 }
    );
    const state = r.data?.ueContextInfo?.connectionState || 'IDLE';
    const map = { CONNECTED: 'REACHABLE', IDLE: 'REACHABLE', DEREGISTERED: 'UNREACHABLE' };
    res.json({ reachabilityStatus: map[state] || 'UNREACHABLE', checkedAt: new Date().toISOString() });
  } catch {
    res.json({ reachabilityStatus: 'UNREACHABLE', checkedAt: new Date().toISOString() });
  }
});

function phoneToSupi(phone) {
  const digits = phone.replace(/\D/g, '').slice(-9);
  return `imsi-20893${digits.padStart(10, '0')}`;
}
module.exports = router;
