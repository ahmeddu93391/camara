const router = require('express').Router();
const axios  = require('axios');
const { FREE5GC } = require('../index');

router.post('/v0/check', async (req, res) => {
  const { phoneNumber, maxAge = 24 } = req.body;
  if (!phoneNumber)
    return res.status(400).json({ status: 400, code: 'INVALID_ARGUMENT', message: 'phoneNumber requis' });
  if (maxAge > 240)
    return res.status(400).json({ status: 400, code: 'OUT_OF_RANGE', message: 'maxAge max 240h' });
  try {
    const supi = phoneToSupi(phoneNumber);
    const r = await axios.get(
      `${FREE5GC.udr}/nudr-dr/v1/subscription-data/${supi}/authentication-data`,
      { timeout: 3000 }
    );
    const lastChange = r.data?.authenticationSubscription?.updatedAt;
    const swapped = lastChange
      ? (Date.now() - new Date(lastChange).getTime()) < maxAge * 3600 * 1000
      : false;
    res.json({ swapped });
  } catch {
    res.json({ swapped: false });
  }
});

function phoneToSupi(phone) {
  const digits = phone.replace(/\D/g, '').slice(-9);
  return `imsi-20893${digits.padStart(10, '0')}`;
}
module.exports = router;
