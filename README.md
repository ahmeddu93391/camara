# CAMARA × MCP

Intégration des APIs CAMARA avec un agent IA via le Model Context Protocol (MCP).

## Description

Ce projet démontre comment un agent d'intelligence artificielle peut piloter un réseau télécom 5G de façon autonome en utilisant les APIs CAMARA standardisées. Deux cas d'usage sont implémentés :

- **UC1 - Smart Connectivity Boost** : activation dynamique d'une QoS prioritaire selon le profil réseau du terminal
- **UC2 - Fraud Prevention** : corrélation de signaux réseau pour détecter et bloquer des transactions frauduleuses

## APIs CAMARA implémentées

| API|
| SIM Swap  `/sim-swap/v1/check` |
| Device Status  `/device-reachability-status/v1/retrieve` |
| Quality on Demand  `/quality-on-demand/v1/sessions` |
| Device Location `/location-verification/v3/verify` |
| Profil QoS (5QI) `/quality-on-demand/v1/profiles/{numero}` |

## Structure du projet

```
camara/
├── index.js                    # Serveur Express + OAuth2
├── Dockerfile
├── routes/
│   ├── simSwap.js              # API SIM Swap 
│   ├── deviceStatus.js         # API Device Status 
│   ├── location.js             # API Device Location 
│   └── qod.js                  # API Quality on Demand + Profil 5QI
├── data/
│   ├── locations.js            # Localisations fictives par abonné
│   └── simswaps.js             # Registre des SIM Swaps simulés
├── simulate-fraud.js           # Script de simulation de fraude via UDR
├── create-subscriber.js        # Création des abonnés dans free5GC
├── mcp/
│   ├── uc1_qod.py              # Agent UC1 - Smart Connectivity Boost
│   └── uc2_fraud.py            # Agent UC2 - Fraud Prevention
└── test-*.js                   # Scripts de test des APIs
```

## Abonnés de test

| IMSI | Numéro | 5QI | Service | Profil QoS |
|---|---|---|---|---|
| imsi-208930000000001 | 0900000001 | 1 | Voix temps réel | QOS_E |
| imsi-208930000000002 | 0900000002 | 2 | Vidéo temps réel | QOS_E |
| imsi-208930000000003 | 0900000003 | 4 | Jeu en ligne | QOS_L |
| imsi-208930000000004 | 0900000004 | 9 | Navigation web | QOS_M |
| imsi-208930000000005 | 0900000005 | 8 | Téléchargement | QOS_S |

Clé commune : `8baf473f2f8fd09487cccbd7097c6862`  
OPC : `8e27b6af0e692e750f32667a3b14605d`

## Scénarios de fraude (UC2)

| Numéro | SIM Swap | Localisation | Décision attendue |
|---|---|---|---|
| 0900000001 | Non | Paris, France | APPROUVER |
| 0900000002 | Oui (récent) | New York, USA | BLOQUER |
| 0900000003 | Non | Paris, France | APPROUVER |
| 0900000004 | Oui (récent) | Tokyo, Japon | BLOQUER |
| 0900000005 | Non | Paris, France | APPROUVER |

## Installation et démarrage

### Prérequis

- Docker et Docker Compose
- Node.js v20+
- free5GC Compose
- Python 3.10+ et Ollama (llama3.2)

### Démarrer le mock CAMARA (VM 1)

```bash
git clone https://github.com/ahmeddu93391/camara.git
cd camara

docker build -t camara .
docker run -d \
  --name camara \
  --network free5gc-compose_privnet \
  --add-host=host.docker.internal:host-gateway \
  -p 3000:3000 \
  camara
```

### Créer les abonnés dans free5GC

```bash
node create-subscriber.js
```

### Simuler les fraudes pour UC2

```bash
node simulate-fraud.js
```

### Lancer les agents IA

```bash
# UC1 - Smart Connectivity Boost
python3 mcp/uc1_qod.py

# UC2 - Fraud Prevention
python3 mcp/uc2_fraud.py
```

## Authentification OAuth2

Toutes les APIs nécessitent un token Bearer :

```bash
curl -X POST http://localhost:3000/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=test&client_secret=test"
```

## Tests

```bash
node test-sim-swap.js        # Test SIM Swap
node test-device-status.js   # Test Device Status
node test-location.js        # Test Device Location
node test-both.js            # Test toutes les APIs
```

## Références

- [CAMARA Project](https://camaraproject.org)
- [GitHub CAMARA - Device Location](https://github.com/camaraproject/DeviceLocation)
- [GitHub CAMARA - Quality on Demand](https://github.com/camaraproject/QualityOnDemand)
- [GitHub CAMARA - Device Status](https://github.com/camaraproject/DeviceStatus)
- [free5GC](https://free5gc.org)
- [UERANSIM](https://github.com/aligungr/UERANSIM)
- [Model Context Protocol](https://modelcontextprotocol.io)
