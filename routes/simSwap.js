const router = require('express').Router();
const axios  = require('axios');

const WEBUI = 'http://host.docker.internal:5000';

async function getWebuiToken() {
  const login = await axios.post(`${WEBUI}/api/login`, {
    username: 'admin',
    password: 'free5gc'
  });
  return login.data.access_token;
}

router.post('/v0/check', async (req, res) => {
  const { phoneNumber, maxAge = 24 } = req.body;

  if (!phoneNumber)
    return res.status(400).json({ status: 400, code: 'INVALID_ARGUMENT', message: 'phoneNumber requis' });
  if (maxAge > 240)
    return res.status(400).json({ status: 400, code: 'OUT_OF_RANGE', message: 'maxAge max 240h' });

  try {
    const token = await getWebuiToken();

    // Convertir le numéro en GPSI pour chercher l'abonné
    const gpsi = phoneToGpsi(phoneNumber);

    // Récupérer tous les abonnés
    const subs = await axios.get(`${WEBUI}/api/subscriber`, {
      headers: { Token: token }
    });

    // Chercher l'abonné correspondant
    const subscriber = subs.data.find(s => s.gpsi === gpsi);

    if (!subscriber) {
      return res.status(404).json({
        status: 404,
        code: 'NOT_FOUND',
        message: `Abonné ${phoneNumber} non trouvé`
      });
    }

    // Récupérer les détails de l'abonné
    const detail = await axios.get(
      `${WEBUI}/api/subscriber/${subscriber.ueId}/${subscriber.plmnID}`,
      { headers: { Token: token } }
    );

    // Vérifier si la SIM a changé dans la fenêtre maxAge
    const updatedAt = detail.data.updatedAt || detail.data.createdAt;
    const swapped = updatedAt
      ? (Date.now() - new Date(updatedAt).getTime()) < maxAge * 3600 * 1000
      : false;

    res.json({
      swapped,
      checkedAt: new Date().toISOString()
    });

  } catch(e) {
    console.error('[SIM Swap] Erreur :', e.response ? e.response.data : e.message);
    res.json({ swapped: false, checkedAt: new Date().toISOString() });
  }
});

function phoneToGpsi(phone) {
  const digits = phone.replace(/\D/g, '').slice(-10);
  return `msisdn-${digits}`;
}

module.exports = router;
