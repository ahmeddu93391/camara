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


def obtenir_token_camara():
    r = requests.post(
        CAMARA + "/oauth/token",
        data="grant_type=client_credentials&client_id=test&client_secret=test",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=10
    )
    r.raise_for_status()
    return r.json()["access_token"]

def verifier_statut_terminal(numero):
    token = obtenir_token_camara()
    r = requests.post(
        CAMARA + "/device-reachability-status/v1/retrieve",
        json={"device": {"phoneNumber": numero}},
        headers={
            "Authorization": "Bearer " + token,
            "Content-Type":  "application/json"
        },
        timeout=10
    )
    r.raise_for_status()
    return r.json()

def obtenir_5qi_depuis_camara(numero):
    token = obtenir_token_camara()
    try:
        r = requests.get(
            CAMARA + "/quality-on-demand/v1/profiles/" + numero,
            headers={"Authorization": "Bearer " + token},
            timeout=10
        )
        r.raise_for_status()
        data   = r.json()
        fiveQI = data.get("5qi", 9)
        info   = CORRESPONDANCE_5QI.get(fiveQI, {"profil": "QOS_M", "description": "Inconnu"})
        return {
            "5qi":         fiveQI,
            "profil":      info["profil"],
            "description": info["description"],
            "source":      data.get("source", "camara")
        }
    except Exception as e:
        print(f"    Erreur lecture 5QI : {e}")
        return {"5qi": 9, "profil": "QOS_M", "description": "Navigation web (défaut)", "source": "default"}

def creer_session_qos(numero, profil, duree=3600):
    token = obtenir_token_camara()
    r = requests.post(
        CAMARA + "/quality-on-demand/v1/sessions",
        json={
            "device":     {"phoneNumber": numero},
            "qosProfile": profil,
            "duration":   duree
        },
        headers={
            "Authorization": "Bearer " + token,
            "Content-Type":  "application/json"
        },
        timeout=10
    )
    r.raise_for_status()
    return r.json()

def supprimer_session_qos(session_id):
    token = obtenir_token_camara()
    r = requests.delete(
        CAMARA + "/quality-on-demand/v1/sessions/" + session_id,
        headers={"Authorization": "Bearer " + token},
        timeout=10
    )
    return r.status_code

def analyser_avec_llm(numero, statut, profil_reseau):
    prompt = f"""Je suis un agent IA de gestion de réseau télécom 5G.

=== TERMINAL ===
Numéro : {numero}
Statut : {statut.get('reachabilityStatus', 'INCONNU')}
État CM: {statut.get('cmState', 'inconnu')}

=== PROFIL RÉSEAU (lu depuis CAMARA/free5GC) ===
5QI         : {profil_reseau['5qi']}
Type service: {profil_reseau['description']}
Profil QoS  : {profil_reseau['profil']}

=== RÈGLES STRICTES ===
1. Si statut = UNREACHABLE → decision = REJETER obligatoirement
2. Si statut = REACHABLE   → decision = ACTIVER avec le profil QoS du 5QI
3. Ne jamais choisir un profil différent de celui indiqué par le 5QI

Réponds UNIQUEMENT avec ce JSON exact, sans texte avant ou après :
{{
  "decision": "ACTIVER",
  "profilQos": "{profil_reseau['profil']}",
  "duree": 3600,
  "raison": "explication courte"
}}"""

    try:
        r = requests.post(
            OLLAMA,
            json={"model": "llama3.2", "prompt": prompt, "stream": False},
            timeout=30
        )
        return r.json()["response"]
    except Exception as e:
        print(f"    LLM indisponible : {e}")
        return None

def analyser_reponse_llm(reponse, profil_reseau, statut):
    reachability = statut.get('reachabilityStatus', 'INCONNU')

    # Règle absolue — terminal UNREACHABLE = toujours REJETER
    if reachability == 'UNREACHABLE':
        return {
            "decision":  "REJETER",
            "profilQos": profil_reseau['profil'],
            "duree":     3600,
            "raison":    "Terminal non joignable — rejet automatique"
        }

    if not reponse:
        print("    LLM indisponible — aucune décision possible sans l'agent IA")
        return {
            "decision":  "EN_ATTENTE",
            "profilQos": None,
            "duree":     0,
            "raison":    "LLM indisponible — décision suspendue"
        }

    try:
        match = re.search(r'\{.*?\}', reponse, re.DOTALL)
        if match:
            data = json.loads(match.group())
            # Forcer le bon profil selon le 5QI
            data['profilQos'] = profil_reseau['profil']

            # LLM a dit REJETER pour un terminal REACHABLE — décision incohérente
            if reachability == 'REACHABLE' and data.get('decision') == 'REJETER':
                print("    LLM a dit REJETER malgré REACHABLE — décision suspendue")
                return {
                    "decision":  "EN_ATTENTE",
                    "profilQos": None,
                    "duree":     0,
                    "raison":    "Décision LLM incohérente — suspendue"
                }

            return data
    except:
        pass

    # JSON invalide — ne pas décider sans LLM
    print("Réponse LLM invalide — décision suspendue")
    return {
        "decision":  "EN_ATTENTE",
        "profilQos": None,
        "duree":     0,
        "raison":  "Réponse LLM invalide — décision suspendue"
    }


def executer_uc1(numero):
    print("=" * 60)
    print("UC1 — Boost de Connectivité Intelligent")
    print(f"Terminal : {numero}")
    print("=" * 60)
    debut = time.time()
    print("\n[1] Vérification du terminal via CAMARA...")
    statut = verifier_statut_terminal(numero)
    print(f"    Statut  : {statut.get('reachabilityStatus')} ({statut.get('source')})")
    if statut.get('cmState'):
        print(f"    État CM : {statut.get('cmState')}")

    print("\n[2] Lecture du profil réseau via CAMARA...")
    profil_reseau = obtenir_5qi_depuis_camara(numero)
    print(f"    5QI         : {profil_reseau['5qi']}")
    print(f"    Type service: {profil_reseau['description']}")
    print(f"    Profil QoS  : {profil_reseau['profil']}")
    print(f"    Source      : {profil_reseau['source']}")
    
    print("\n[3] Analyse par l'agent IA...")
    reponse_brute = analyser_avec_llm(numero, statut, profil_reseau)
    decision      = analyser_reponse_llm(reponse_brute, profil_reseau, statut)
    print(f"    Décision   : {decision.get('decision')}")
    print(f"    Profil QoS : {decision.get('profilQos')}")
    print(f"    Raison     : {decision.get('raison')}")

    session = None

    if decision.get('decision') == 'ACTIVER':
        print("\n[4] Activation de la session QoS via CAMARA...")
        session = creer_session_qos(
            numero,
            profil=decision.get('profilQos', 'QOS_M'),
            duree=decision.get('duree', 3600)
        )
        print(f"    Session ID : {session.get('sessionId')}")
        print(f"    Statut     : {session.get('status')}")
        print(f"    Expiration : {session.get('expiresAt')}")

    elif decision.get('decision') == 'REJETER':
        print("\n[4] QoS REJETÉE — terminal non joignable")

    elif decision.get('decision') == 'EN_ATTENTE':
        print("\n[4] QoS EN ATTENTE — agent IA indisponible, aucune action effectuée")

    latence = int((time.time() - debut) * 1000)

    print("\n" + "=" * 60)
    print("RÉSULTAT FINAL")
    print("=" * 60)
    print(f"Décision   : {decision.get('decision')}")
    print(f"Profil QoS : {decision.get('profilQos') or 'N/A'}")
    print(f"Latence    : {latence}ms (objectif < 500ms)")
    print(f"Performance: {'OK' if latence < 500 else 'Trop lent'}")
    
    if session and session.get('sessionId'):
        print("\n[5] Suppression session QoS via CAMARA...")
        code = supprimer_session_qos(session['sessionId'])
        print(f"    HTTP {code}")

    return {
        "numero":         numero,
        "5qi":            profil_reseau['5qi'],
        "typeService":    profil_reseau['description'],
        "statutTerminal": statut.get('reachabilityStatus'),
        "decision":       decision.get('decision'),
        "profilQos":      decision.get('profilQos'),
        "latenceMs":      latence,
        "sessionId":      session.get('sessionId') if session else None
    }

if __name__ == "__main__":
    terminaux = [
        "0900000001",
        "0900000002",
        "0900000003",
        "0900000004",
        "0900000005",
    ]

    resultats = []
    for numero in terminaux:
        print("\n")
        r = executer_uc1(numero)
        resultats.append(r)
        time.sleep(1)

    print("\n\n" + "=" * 60)
    print("RÉSUMÉ DE LA SIMULATION")
    print("=" * 60)
    print(f"{'Numéro':<15} {'5QI':>5} {'Service':<25} {'Profil':>8} {'Décision':>12}")
    print("-" * 60)
    for r in resultats:
        profil = r['profilQos'] if r['profilQos'] else 'N/A'
        print(f"{r['numero']:<15} {r['5qi']:>5} {r['typeService']:<25} {profil:>8} {r['decision']:>12}")
