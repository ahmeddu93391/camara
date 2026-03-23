import requests
import json
import re
import time

CAMARA = "http://192.168.163.216:3000"
OLLAMA = "http://localhost:11434/api/generate"

CORRESPONDANCE_5QI = {
    1: {"profil": "QOS_E", "description": "Voix temps réel"},
    2: {"profil": "QOS_E", "description": "Vidéo temps réel"},
    3: {"profil": "QOS_E", "description": "Jeu temps réel"},
    4: {"profil": "QOS_L", "description": "Jeu en ligne"},
    5: {"profil": "QOS_L", "description": "IMS signalisation"},
    6: {"profil": "QOS_L", "description": "Streaming live"},
    7: {"profil": "QOS_L", "description": "Voix interactive"},
    8: {"profil": "QOS_S", "description": "Téléchargement"},
    9: {"profil": "QOS_M", "description": "Navigation web"},
}

def obtenir_token():
    r = requests.post(
        CAMARA + "/oauth/token",
        data="grant_type=client_credentials&client_id=test&client_secret=test",
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    return r.json()["access_token"]

def verifier_statut_terminal(numero):
    token = obtenir_token()
    r = requests.post(
        CAMARA + "/device-reachability-status/v1/retrieve",
        json={"device": {"phoneNumber": numero}},
        headers={
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json"
        }
    )
    return r.json()

def obtenir_profil_reseau(numero):
    """Récupère le profil QoS de l'abonné depuis free5GC via le mock CAMARA"""
    token = obtenir_token()
    r = requests.get(
        CAMARA + "/quality-on-demand/v1/profiles/" + numero,
        headers={"Authorization": "Bearer " + token}
    )
    if r.status_code == 200:
        data = r.json()
        fiveQI = data.get("5qi", 9)
        return {
            "5qi": fiveQI,
            "profil": CORRESPONDANCE_5QI.get(fiveQI, {"profil": "QOS_M", "description": "Inconnu"})["profil"],
            "description": CORRESPONDANCE_5QI.get(fiveQI, {"profil": "QOS_M", "description": "Inconnu"})["description"]
        }
    # Valeur par défaut si endpoint pas disponible
    return {"5qi": 9, "profil": "QOS_M", "description": "Navigation web (défaut)"}

def creer_session_qos(numero, profil, duree=3600):
    token = obtenir_token()
    r = requests.post(
        CAMARA + "/quality-on-demand/v1/sessions",
        json={
            "device": {"phoneNumber": numero},
            "qosProfile": profil,
            "duration": duree
        },
        headers={
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json"
        }
    )
    return r.json()

def supprimer_session_qos(session_id):
    token = obtenir_token()
    r = requests.delete(
        CAMARA + "/quality-on-demand/v1/sessions/" + session_id,
        headers={"Authorization": "Bearer " + token}
    )
    return r.status_code

def analyser_avec_llm(numero, statut, profil_reseau):
    prompt = """Tu es un agent IA de gestion de réseau télécom 5G.

Une application demande une qualité de service prioritaire.

=== TERMINAL ===
Numéro : """ + numero + """
Statut : """ + statut.get('reachabilityStatus', 'INCONNU') + """
État   : """ + statut.get('cmState', 'inconnu') + """

=== PROFIL RÉSEAU DE L'ABONNÉ (lu depuis free5GC) ===
5QI         : """ + str(profil_reseau['5qi']) + """
Type service: """ + profil_reseau['description'] + """
Profil QoS  : """ + profil_reseau['profil'] + """

=== PROFILS QoS DISPONIBLES ===
QOS_E : latence < 10ms   → voix/vidéo temps réel (5QI 1,2,3)
QOS_L : latence < 50ms   → jeu en ligne, streaming live (5QI 4,5,6,7)
QOS_M : latence < 200ms  → navigation web (5QI 9)
QOS_S : pas de contrainte → téléchargement (5QI 8)

=== RÈGLES ===
- Si terminal UNREACHABLE → REJETER obligatoirement
- Si terminal REACHABLE   → utiliser le profil QoS correspondant au 5QI de l'abonné
- Ne pas dépasser le profil QoS prévu pour cet abonné

Réponds UNIQUEMENT en JSON :
{
  "decision": "ACTIVER ou REJETER",
  "profilQos": "QOS_E ou QOS_L ou QOS_M ou QOS_S",
  "duree": 3600,
  "raison": "explication courte en français"
}"""

    r = requests.post(
        OLLAMA,
        json={
            "model": "llama3.2",
            "prompt": prompt,
            "stream": False
        }
    )
    return r.json()["response"]

def analyser_reponse_llm(reponse):
    try:
        match = re.search(r'\{.*\}', reponse, re.DOTALL)
        if match:
            return json.loads(match.group())
    except:
        pass
    return {
        "decision": "REJETER",
        "profilQos": "QOS_M",
        "duree": 3600,
        "raison": "Erreur d'analyse - rejet par défaut"
    }

def executer_uc1(numero):
    print("=" * 60)
    print("UC1 - Boost de Connectivité Intelligent")
    print(f"Terminal : {numero}")
    print("=" * 60)

    debut = time.time()

    # Statut terminal
    print("\n[1] Vérification du terminal...")
    statut = verifier_statut_terminal(numero)
    print(f"    Statut  : {statut.get('reachabilityStatus')} ({statut.get('source')})")
    if statut.get('cmState'):
        print(f"    État CM : {statut.get('cmState')}")

    # Profil réseau depuis free5GC
    print("\n[2] Lecture du profil réseau depuis free5GC...")
    profil_reseau = obtenir_profil_reseau(numero)
    print(f"    5QI         : {profil_reseau['5qi']}")
    print(f"    Type service: {profil_reseau['description']}")
    print(f"    Profil QoS  : {profil_reseau['profil']}")

    # Décision LLM
    print("\n[3] Analyse par l'agent IA...")
    reponse_brute = analyser_avec_llm(numero, statut, profil_reseau)
    decision = analyser_reponse_llm(reponse_brute)
    print(f"    Décision   : {decision.get('decision')}")
    print(f"    Profil QoS : {decision.get('profilQos')}")
    print(f"    Raison     : {decision.get('raison')}")

    session = None

    # Activation QoS
    if decision.get('decision') == 'ACTIVER':
        print("\n[4] Activation de la session QoS...")
        session = creer_session_qos(
            numero,
            profil=decision.get('profilQos', 'QOS_M'),
            duree=decision.get('duree', 3600)
        )
        print(f"    Session ID : {session.get('sessionId')}")
        print(f"    Statut     : {session.get('status')}")
        print(f"    Expiration : {session.get('expiresAt')}")
    else:
        print("\n[4] QoS REJETÉE")

    latence = int((time.time() - debut) * 1000)

    print("\n" + "=" * 60)
    print("RÉSULTAT FINAL :")
    print("=" * 60)
    print(f"Décision   : {decision.get('decision')}")
    print(f"Profil QoS : {decision.get('profilQos')}")
    print(f"Latence    : {latence}ms (objectif < 500ms)")
    if latence < 500:
        print("Performance : OK")
    else:
        print("Performance : Trop lent")

    # Étape 5 - Suppression session
    if session and session.get('sessionId'):
        print("\n[5] Suppression session QoS...")
        code = supprimer_session_qos(session['sessionId'])
        print(f"    HTTP {code}")

    return {
        "numero": numero,
        "5qi": profil_reseau['5qi'],
        "typeService": profil_reseau['description'],
        "statutTerminal": statut.get('reachabilityStatus'),
        "decision": decision.get('decision'),
        "profilQos": decision.get('profilQos'),
        "latenceMs": latence,
        "sessionId": session.get('sessionId') if session else None
    }

if __name__ == "__main__":
    terminaux = [
        "0900000001",  # 5QI=1 → QOS_E (visioconférence)
        "0900000002",  # 5QI=2 → QOS_E (vidéo temps réel)
        "0900000003",  # 5QI=4 → QOS_L (jeu en ligne)
        "0900000004",  # 5QI=9 → QOS_M (navigation)
        "0900000005",  # 5QI=8 → QOS_S (téléchargement)
    ]

    resultats = []
    for numero in terminaux:
        print("\n")
        r = executer_uc1(numero)
        resultats.append(r)
        time.sleep(1)

    # Résumé
    print("\n\n" + "=" * 60)
    print("RÉSUMÉ DE LA SIMULATION")
    print("=" * 60)
    print(f"{'Numéro':<15} {'5QI':>5} {'Service':<25} {'Profil':>8} {'Décision':>10}")
    print("-" * 60)
    for r in resultats:
        print(f"{r['numero']:<15} {r['5qi']:>5} {r['typeService']:<25} {r['profilQos']:>8} {r['decision']:>10}")
