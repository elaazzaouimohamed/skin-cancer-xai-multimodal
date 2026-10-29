# DermAI-XAI — plateforme d'aide au diagnostic explicable

Plateforme web qui met en service le modèle du PFA « IA explicable et multimodale pour l'aide au diagnostic du cancer à partir d'images médicales ».

```
 React (Vite, :5173)  ──►  Spring Boot (:8080)  ──►  Service d'inférence Python (FastAPI, :8000)
   formulaire, résultats,      orchestration,             DermLIP + modèle final (fusion image+clinique)
   historique                  historique (H2),           probabilité, seuil, contributions,
                               garde-fou du rapport        concepts, carte d'occlusion
                                     │
                                     └──►  LM Studio (:1234, API compatible OpenAI)
                                           reformulation du compte rendu UNIQUEMENT
```

**Principe de fiabilité** : la décision (probabilité, seuil, conclusion) est calculée uniquement par le modèle entraîné et évalué. Le LLM local reçoit les valeurs déjà calculées (jamais l'image) et ne fait que les reformuler ; le backend vérifie que la probabilité et la conclusion ne sont pas modifiées et le compte rendu source reste affiché.

## 1. Prérequis

| Outil | Version testée sur ce poste |
|---|---|
| Java (Temurin) | 17 |
| MySQL Server + Workbench | 8.x, schéma `dermai-xai` |
| Maven | 3.9 |
| Node.js / npm | 24 / 11 |
| Python | 3.10+ (3.14 présent) |
| LM Studio | avec le modèle **gemma-3-4b-it** (déjà téléchargé) |

## 2. Artefacts du modèle (sortie Kaggle)

Le service d'inférence lit les sorties de la **version 2** du notebook Kaggle `pipeline-cancer-peau-xai-multimodal` :

1. Sur Kaggle → notebook → onglet **Output** → **Download notebook output**.
2. Décompresser dans `D:\Projetcs\Pfa-Project\outputs\kaggle_v2\` (le dossier `data/cache_256` est inutile et peut être supprimé).

Fichiers utilisés : `outputs/checkpoints/final_model.joblib`, `outputs/reports/05_synthese.json`,
`data/processed/{concept_text_embeddings.npz, concepts_selected.csv, concept_scores.csv, features_dermlip_vitb16.npy, features_dermlip_vitb16_ids.csv, splits.csv}`.

> Si `final_model.joblib` ne se charge pas (versions de scikit-learn différentes entre Kaggle et ce PC), le service **reconstruit automatiquement** le modèle à partir des caractéristiques Kaggle (même procédure déterministe que le notebook 05) et l'enregistre dans `local_model.joblib`.

DermLIP est un modèle à accès conditionnel : l'accès est déjà accordé à votre compte Hugging Face. Définir le jeton dans la session PowerShell avant de lancer le service (premier lancement : téléchargement ≈ 600 Mo, ensuite en cache) :

```powershell
$env:HF_TOKEN = "<votre jeton Hugging Face en lecture>"
```

## 3. Lancement (4 terminaux)

**a. LM Studio** : onglet *Developer* → charger `gemma-3-4b-it` → **Start Server** (port 1234). Vérifier l'identifiant du modèle dans `http://127.0.0.1:1234/v1/models` ; s'il diffère, l'indiquer dans `backend/src/main/resources/application.yml` (`app.llm.model`).

**b. Service d'inférence**

```powershell
cd D:\Projetcs\Pfa-Project\platform\ml-service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:HF_TOKEN = "<jeton>"
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Contrôle : `http://127.0.0.1:8000/health` doit renvoyer `"modelLoaded": true`.

**c. Backend Spring Boot**

```powershell
cd D:\Projetcs\Pfa-Project\platform\backend
mvn spring-boot:run
```

**d. Interface React**

```powershell
cd D:\Projetcs\Pfa-Project\platform\frontend
npm install
npm run dev
```

Ouvrir **http://localhost:5173**. Se connecter avec le compte administrateur (section 4) ou créer un compte. Les pastilles en haut indiquent si l'API, le modèle et le LLM répondent.

## 4. Comptes, rôles et sécurité

Authentification **JWT** (Spring Security, mots de passe hachés BCrypt, session sans état, jeton valable 12 h). Le compte est relu en base à chaque requête : un compte désactivé ou un rôle modifié prend effet immédiatement.

| Rôle | Accès |
|---|---|
| **Administrateur** | tableau de bord global (comptes, analyses, suspicions, activité 14 jours, médecins les plus actifs), gestion des utilisateurs (valider les médecins, activer/désactiver, changer le rôle, réinitialiser le mot de passe, créer, supprimer), tous les dossiers patients et toutes les analyses |
| **Médecin** | ses dossiers patients (création, modification, suivi de l'évolution de la probabilité), analyses rattachées à un patient, conversation de suivi par patient, tableau de bord « patients à revoir » |
| **Patient** | ses propres analyses et conversations, comptes rendus en style « patient » |

- **Inscription** (`/inscription`) : un compte *patient* est actif immédiatement ; un compte *médecin* reste **en attente** jusqu'à sa validation par un administrateur (page Utilisateurs → « Valider »).
- **Administrateur initialisé à chaque démarrage** à partir de `application.yml` (`app.admin`) : créé s'il n'existe pas, toujours actif avec le rôle ADMIN (`reset-password: true` remet son mot de passe en cas d'oubli) : `admin@dermai.ma` / `Admin@2026`. **Changez ce mot de passe** (menu utilisateur → Mon profil) et la clé `app.security.jwt-secret` avant toute démonstration publique.
- Les analyses et conversations créées avant l'ajout des comptes sont rattachées automatiquement à l'administrateur.

## 5. API (backend)

Toutes les routes `/api/**` exigent l'en-tête `Authorization: Bearer <jeton>`, sauf `/api/auth/login`, `/api/auth/register` et `/api/system/status`. Les images (`<img src>`) acceptent `?access_token=<jeton>`.

| Méthode | Route | Rôle |
|---|---|---|
| POST | `/api/auth/register` · `/api/auth/login` | inscription · connexion (renvoie le jeton) |
| GET · PUT | `/api/auth/me` | profil · modification du profil |
| PUT | `/api/auth/password` | changement de mot de passe |
| GET | `/api/dashboard` | indicateurs de l'utilisateur connecté |
| POST | `/api/analyses` (multipart : `image`, `clinical` JSON, `occlusion`, `style`, `patientId` facultatif) | nouvelle analyse |
| GET | `/api/analyses` | historique (100 dernières ; toutes pour l'administrateur) |
| GET | `/api/analyses/{id}` · `/api/analyses/{id}/image` | détail · photo |
| POST | `/api/analyses/{id}/report?style=medecin\|patient` | régénérer le compte rendu (la décision ne change pas) |
| DELETE | `/api/analyses/{id}` | supprimer (auteur ou administrateur) |
| GET · POST | `/api/patients` (`?q=` recherche) | dossiers patients (médecin : les siens ; administrateur : tous) |
| GET · PUT · DELETE | `/api/patients/{id}` | dossier + analyses · modifier · supprimer (avec ses analyses) |
| GET | `/api/admin/stats` | statistiques globales |
| GET · POST | `/api/admin/users` | comptes · créer un compte |
| PATCH · DELETE | `/api/admin/users/{id}` | rôle, activation, mot de passe · supprimer |
| GET | `/api/system/status` · `/api/system/model-info` | état des services · informations du modèle |
| POST · GET | `/api/chat/sessions` (`?patientId=` facultatif) | créer (libre ou rattachée à un patient) · lister ses conversations |
| GET · PATCH · DELETE | `/api/chat/sessions/{id}` | détail · renommer · supprimer |
| POST | `/api/chat/sessions/{id}/messages` (multipart : `text` et/ou `image`, `occlusion`, `style`) | message texte, photo, ou les deux |
| POST | `/api/chat/sessions/{id}/rerun` | relancer le modèle sur la dernière photo avec les informations mises à jour |
### Mode conversationnel (Chat DermAI)

- **Texte seul** : le LLM extrait les informations cliniques (âge, localisation, symptômes) en JSON structuré, puis répond en s'appuyant uniquement sur les résultats du modèle ; il ne donne jamais de diagnostic et demande une photo.
- **Photo (± texte)** : le modèle entraîné analyse la photo avec les informations cliniques accumulées ; la réponse est une carte de résultat (jauge, carte d'occlusion, facteurs) + le compte rendu reformulé.
- **Nouveau symptôme après une analyse** : le bouton « Relancer l'analyse » réexécute le modèle — seul le modèle peut changer le résultat.
- **Conversation de suivi** (médecin) : rattachée à un dossier patient, l'âge est pré-rempli et chaque analyse rejoint le dossier.
- Ergonomie : photo par glisser-déposer ou collage (Ctrl+V), suggestions de départ, conversations groupées par date, recherche, renommage (double-clic), copie des réponses, rendu Markdown léger.

Base de données : **MySQL** (`localhost:3306`, schéma `dermai-xai`, utilisateur `root`), configurée dans `backend/src/main/resources/application.yml` ; les tables sont créées automatiquement au démarrage. Sans MySQL : profil de secours H2 avec `mvn spring-boot:run "-Dspring-boot.run.profiles=h2"`.

## 6. Démonstration (poster / conférence)

1. Se connecter en administrateur, valider un compte médecin créé depuis /inscription, puis se connecter en médecin.
2. Créer un dossier patient → « Nouvelle analyse » depuis le dossier → montrer la courbe d'évolution.
3. Ouvrir la page **Modèle & méthode** (résultats, principe, limites).
4. Nouvelle analyse avec une image du jeu de **test** (ex. un BCC du nez qui saigne) : montrer la jauge, la carte d'occlusion, les facteurs, puis basculer le compte rendu **Médecin ↔ Patient**.
5. Arrêter le serveur LM Studio : la plateforme continue de fonctionner avec le compte rendu par gabarit (le LLM n'est jamais indispensable à la décision).

*Outil de recherche : ne remplace ni l'examen clinique ni la biopsie.*
