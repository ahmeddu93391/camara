const express = require('express');
const jwt = require('jsonwebtoken');
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const SECRET = 'camara-mock-secret';
const FREE5GC = {
  nef: 'http://10.100.200.6:8000',
  udm: 'http://10.100.200.8:8000',
  amf: 'http://10.100.200.16:8000',
  pcf: 'http://10.100.200.7:8000',
  udr: 'http://10.100.200.12:8000',
};
module.exports.FREE5GC = FREE5GC;
module.exports.SECRET  = SECRET;

app.post('/oauth/token', (req, res) => {
  const { client_id, client_secret } = req.body;
  if (!client_id || !client_secret)
    return res.status(401).json({ error: 'invalid_client' });
  const token = jwt.sign(
    { client_id, scope: req.body.scope || '*' },
    SECRET,
    { expiresIn: '1h' }
  );
  res.json({ access_token: token, token_type: 'Bearer', expires_in: 3600 });
});

function authMiddleware(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  try { req.auth = jwt.verify(token, SECRET); next(); }
  catch { res.status(401).json({ error: 'invalid_token' }); }
}

// WebUI
app.use('/webui/sim-swap',                   authMiddleware, require('./routes/simSwapWebui'));
app.use('/webui/device-reachability-status', authMiddleware, require('./routes/deviceStatusWebui'));
app.use('/webui/location-verification',      authMiddleware, require('./routes/locationWebui'));

// APIs internes free5GC
app.use('/sim-swap',                   authMiddleware, require('./routes/simSwap'));
app.use('/device-reachability-status', authMiddleware, require('./routes/deviceStatus'));
app.use('/location-verification',      authMiddleware, require('./routes/location'));
app.use('/location-retrieval',         authMiddleware, require('./routes/location'));

// QoD
app.use('/quality-on-demand', authMiddleware, require('./routes/qod'));

app.listen(3000, () => console.log('[CAMARA Mock] Port 3000'));
