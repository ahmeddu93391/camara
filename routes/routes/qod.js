const router = require('express').Router();
const { v4: uuid } = require('uuid');
const sessions = {};

router.post('/v1/sessions', (req, res) => {
  const { device, qosProfile, duration = 3600 } = req.body;
  const phoneNumber = device?.phoneNumber;
  if (!phoneNumber || !qosProfile)
    return res.status(400).json({ status: 400, code: 'INVALID_ARGUMENT', message: 'phoneNumber et qosProfile requis' });
  const existing = Object.values(sessions).find(
    s => s.phoneNumber === phoneNumber && s.status === 'AVAILABLE'
  );
  if (existing) return res.json(existing);
  const sessionId = uuid();
  sessions[sessionId] = {
    sessionId, phoneNumber, qosProfile, status: 'AVAILABLE',
    startedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + duration * 1000).toISOString(),
  };
  res.status(201).json(sessions[sessionId]);
});

router.post('/v1/sessions/:sessionId/extend', (req, res) => {
  const session = sessions[req.params.sessionId];
  if (!session) return res.status(404).json({ status: 404, code: 'NOT_FOUND' });
  const extra = req.body.requestedAdditionalDuration || 3600;
  session.expiresAt = new Date(new Date(session.expiresAt).getTime() + extra * 1000).toISOString();
  res.json(session);
});

router.get('/v1/sessions/:sessionId', (req, res) => {
  const session = sessions[req.params.sessionId];
  if (!session) return res.status(404).json({ status: 404, code: 'NOT_FOUND' });
  res.json(session);
});

router.delete('/v1/sessions/:sessionId', (req, res) => {
  if (!sessions[req.params.sessionId])
    return res.status(404).json({ status: 404, code: 'NOT_FOUND' });
  delete sessions[req.params.sessionId];
  res.status(204).send();
});

module.exports = router;
