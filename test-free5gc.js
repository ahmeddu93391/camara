const axios = require('axios');

const WEBUI = 'http://localhost:5000';

async function main() {
  // Login
  const login = await axios.post(`${WEBUI}/api/login`, {
    username: 'admin',
    password: 'free5gc'
  });

  console.log('Réponse login complète :', JSON.stringify(login.data, null, 2));
  console.log('Headers réponse :', JSON.stringify(login.headers, null, 2));

  const token = login.data.access_token;

  console.log('\nRecupération - Token');
  try {
    const r2 = await axios.get(`${WEBUI}/api/subscriber`, {
      headers: { 'Token': token }
    });
    console.log('OK :', r2.data);
  } catch(e) { console.log('Echec :', e.response.data); }
}

main().catch(err => {
  console.error('Erreur globale :', err.message);
});
