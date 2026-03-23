import requests
import json
import re
import time

CAMARA = "http://192.168.163.216:3000"
OLLAMA = "http://localhost:11434/api/generate"
NRF    = "http://10.100.200.4:8000"
UDM    = "http://10.100.200.8:8000"
UDR    = "http://10.100.200.12:8000"
NEF_ID = "9dea0e89-3b26-4b74-9159-5a01ffce1127"

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

def obtenir_token_camara():
    r = requests.post(
        CAMARA + "/oauth/token",
        data="grant_type=client_credentials&client_id=test&client_secret=test",
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    return r.json()["access_token"]

def obtenir_token_nrf(target_nf_type, scope):
    r = requests.post(
        NRF + "/oauth2/token",
        data={
            "grant_type": "client_credentials",
            "nfInstanceId": NEF_ID,
            "nfType": "NEF",
            "targetNfType": target_nf_type,
            "scope": scope,
            "requesterPlmn": '{"mcc":"208","mnc":"93"}'
        }
    )
    return r.json()["access_token"]

def obtenir_supi_depuis_numero(numero):
    msisdn = "msisdn-" + numero.replace("+", "").replace(" ", "")[-10:]
    token  = obtenir_token_nrf("UDM", "nudm-sdm")
    r = requests.get(
        f"{UDM}/nudm-sdm/v2/{msisdn}/id-translation-result",
        headers={"Authorization": "Bearer " + token}
    )
    if r.status_code == 200:
        return r.json().get("supi")
    return None

def obtenir_5qi_depuis_reseau(numero):
    try:
        supi  = obtenir_supi_depuis_numero(numero)
        if not supi:
            return {"5qi": 9, "profil": "QOS_M", "description": "Navigation web (défaut)"}

        token = obtenir_token_nrf("UDR", "nudr-dr")
        r = requests.get(
            f"{UDR}/nudr-dr/v2/subscription-data/{supi}/20893/provisioned-data/sm-data",
            headers={"Authorization": "Bearer " + token}
        )

        if r.status_code == 200:
            data = r.json()
            # Chercher le 5QI dans les données de session
            if isinstance(data, list) and len(data) > 0:
                dnn_configs = data[0].get("dnnConfigurations", {})
                internet    = dnn_configs.get("internet", {})
                fiveQI      = internet.get("5gQosProfile", {}).get("5qi", 9)
                info        = CORRESPONDANCE_5QI.get(fiveQI, {"profil": "QOS_M", "description": "Inconnu"})
                return {"5qi": fiveQI, "profil": info["profil"], "description": info["description"]}

    except Exception as e:
        print(f"    Erreur lecture 5QI : {e}")

    return {"5qi": 9, "profil": "QOS_M", "description": "Navigation web (défaut)"}

def verifier_statut_terminal(numero):
    token = obtenir_token_camara()
    r = requests.post(
        CAMARA + "/device-reachability-status/v1/retrieve",
        json={"device": {"phoneNumber": numero}},
        headers={
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json"
        }
    )
    return r.json()

def creer_session_qos(numero, profil, duree=3600):
    token = obtenir_token_camara()
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
    token = obtenir_token_camara()
    r = requests.delete(
        CAMARA + "/quality-on-demand/v1/sessions/" + session_id,
        headers={"Authorization": "Bearer " + token}
    )
    return r.status_code

def analyser_avec_llm(numero, statut, profil_reseau):
    prompt = """je suis un agent IA de gestion de réseau télécom 5G.

=== TERMINAL ===
Numéro : """ + numero + """
Statut : """ + statut.get('reachabilityStatus', 'INCONNU') + """
État   : """ + statut.get('cmState', 'inconnu') + """

=== PROFIL RÉSEAU DE L'ABONNÉ (lu depuis free5GC) ===
5QI         : """ + str(profil_reseau['5qi']) + """
Type service: """ + profil_reseau['description'] + """
Profil QoS  : """ + profil_reseau['profil'] + """

=== RÈGLES STRICTES ===
1. Si statut = UNREACHABLE → decision = REJETER obligatoirement
2. Si statut = REACHABLE   → decision = ACTIVER avec le profil QoS du 5QI
3. Ne jamais choisir un profil différent de celui indiqué par le 5QI

Réponds UNIQUEMENT avec ce JSON exact, sans texte avant ou après :
{
  "decision": "ACTIVER",
  "profilQos": "QOS_E",
  "duree": 3600,
  "raison": "explication courte"
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

def analyser_reponse_llm(reponse, profil_reseau, statut):
    """Parse la réponse LLM avec fallback intelligent"""

    # Si LLM échoue on applique les règles directement
    if statut.get('reachabilityStatus') == 'UNREACHABLE':
        return {
            "decision": "REJETER",
            "profilQos": profil_reseau['profil'],
            "duree": 3600,
            "raison": "Terminal non joignable - rejet automatique"
        }

    try:
        match = re.search(r'\{.*?\}', reponse, re.DOTALL)
        if match:
            data = json.loads(match.group())
            # Forcer le bon profil selon le 5QI
            data['profilQos'] = profil_reseau['profil']
            return data
    except:
        pass

    # Appliquer les règles directement sans LLM
    return {
        "decision": "ACTIVER",
        "profilQos": profil_reseau['profil'],
        "duree": 3600,
        "raison": f"Profil {profil_reseau['profil']} appliqué selon 5QI={profil_reseau['5qi']} ({profil_reseau['description']})"
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
    profil_reseau = obtenir_5qi_depuis_reseau(numero)
    print(f"    5QI         : {profil_reseau['5qi']}")
    print(f"    Type service: {profil_reseau['description']}")
    print(f"    Profil QoS  : {profil_reseau['profil']}")

    # Décision LLM
    print("\n[3] Analyse par l'agent IA...")
    reponse_brute  = analyser_avec_llm(numero, statut, profil_reseau)
    decision       = analyser_reponse_llm(reponse_brute, profil_reseau, statut)
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
        print("\n[4] QoS REJETÉE - terminal non joignable")

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

    # Suppression session
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
