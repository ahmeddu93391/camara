const router = require('express').Router();
const axios  = require('axios');

const WEBUI = 'http://host.docker.internal:5000';

async function getWebuiToken() {
  const r = await axios.post(`${WEBUI}/api/login`, {
    username: 'admin', password: 'free5gc'
  });
  return r.data.access_token;
}

function phoneToGpsi(phone) {
  const digits = phone.replace(/\D/g, '').slice(-10);
  return `msisdn-${digits}`;
}

router.post('/v0/verify', async (req, res) => {
  const { device, area } = req.body;

  if (!device?.phoneNumber || !area)
    return res.status(400).json({ status: 400, code: 'INVALID_ARGUMENT', message: 'device et area requis' });

  try {
    const token = await getWebuiToken();
    const gpsi  = phoneToGpsi(device.phoneNumber);

    const subs = await axios.get(`${WEBUI}/api/subscriber`, {
      headers: { Token: token }
    });

    const subscriber = subs.data.find(s => s.gpsi === gpsi);

    if (!subscriber)
      return res.status(404).json({ status: 404, code: 'NOT_FOUND', message: 'Abonné non trouvé' });

    res.status(422).json({
      status: 422,
      code: 'LOCATION_VERIFICATION.UNABLE_TO_LOCATE',
      message: 'Localisation non disponible via free5GC sandbox',
      source: 'webui'
    });

  } catch(e) {
    console.error('[Location WebUI] Erreur :', e.response ? e.response.data : e.message);
    res.status(422).json({
      status: 422,
      code: 'LOCATION_VERIFICATION.UNABLE_TO_LOCATE',
      message: 'Erreur WebUI',
      source: 'webui'
    });
  }
});

module.exports = router;
