# IA explicable et multimodale pour l'aide au diagnostic du cancer de la peau

Projet de fin d'année (PFA) — Faculté des Sciences Ben M'Sik, Université Hassan II de Casablanca.
Présenté sous forme de poster à **ICAIS'26**.

**Auteur** : Mohamed Elaazzaoui — [portfolio](https://mohamed-elaazzaoui.vercel.app/)
**Encadrante** : Pr. Sanaa El Filali

> *Explainable multimodal AI for skin-cancer triage: a frozen dermatology vision-language model (DermLIP) combined with clinical data by late fusion, evaluated on PAD-UFES-20 with a patient-grouped protocol, and served through a web platform (React · Spring Boot · FastAPI).*

## Problème

À partir d'une photo de lésion prise au smartphone et d'un court questionnaire clinique, estimer si la lésion est **cancéreuse** (carcinome basocellulaire, carcinome épidermoïde, mélanome) ou **bénigne** (kératose actinique, nævus, kératose séborrhéique), et **expliquer** la décision.

## Méthode

```
Photo ──► DermLIP ViT-B/16 (gelé) ──► vecteur 512-d ──► ACP + régression logistique ──► score image ─┐
                       │                                                                           ├─► régression logistique ──► P(cancer)
                       └─► 16 concepts visuels (explication)                                       │    (fusion tardive / stacking)
Questionnaire ──► imputation + encodage ──► régression logistique ──────────────────► score clinique ─┘
```

- **Données** : [PAD-UFES-20](https://data.mendeley.com/datasets/zr7vgbcyr2/1) — 2 298 images, 1 373 patients, 6 diagnostics.
- **Variables raccourcis exclues** : le profil patient (tabac, alcool, Fitzpatrick…) n'est renseigné que pour les lésions biopsiées, il trahirait le diagnostic.
- **Protocole** : test de 358 images / 197 patients mis de côté ; validation croisée à 5 plis **groupés par patient** sur 1 940 images ; règle de sélection fixée à l'avance ; bootstrap par patient (2 000 tirages).
- **Explicabilité** : contributions image / clinique, 16 concepts visuels DermLIP, cartes d'occlusion (fidélité testée : p = 1,8·10⁻¹²).
- **LLM local** (LM Studio) : reformule uniquement le compte rendu ; la décision vient du modèle entraîné.

## Résultats

| Modèle | AUC validation croisée (5 plis) |
| --- | --- |
| Clinique seule | 0,842 |
| Concepts DermLIP seuls | 0,845 |
| Image · ViT-B/16 ImageNet | 0,862 |
| Image · DermLIP | 0,920 |
| **Fusion image + clinique (retenue)** | **0,931** |

**Test final** (patients jamais vus) : **AUC 0,947** [IC 95 % 0,918 – 0,971], +0,051 par rapport à la clinique seule (IC 95 % [0,013 ; 0,091]).
Au seuil de triage 0,375 : **sensibilité 96,8 %** (180/186), spécificité 78,5 % (135/172), ECE 0,059.

## Organisation du dépôt

| Dossier | Contenu |
| --- | --- |
| `notebooks/` | Pipeline complet (`pipeline-cancer-peau-xai-multimodal.ipynb`, exécuté sur Kaggle) et notebooks par étape 01 → 06 |
| `configs/` | Configuration et vocabulaire de concepts (`concepts.yaml`) |
| `outputs/kaggle_v2/` | Résultats de l'exécution Kaggle : tableaux, figures, caractéristiques, modèle final |
| `platform/` | Plateforme web DermAI-XAI — voir [platform/README.md](platform/README.md) |

## Reproduire

```bash
pip install -r requirements.txt
```

1. Télécharger PAD-UFES-20 depuis Mendeley Data et le décompresser dans `zr7vgbcyr2-1/`.
2. Demander l'accès à [DermLIP](https://huggingface.co/redlessone/DermLIP_ViT-B-16) sur Hugging Face et définir `HF_TOKEN`.
3. Exécuter `notebooks/pipeline-cancer-peau-xai-multimodal.ipynb` (CPU suffisant ; GPU seulement pour l'ajustement fin exploratoire E9).

La plateforme (React + Spring Boot + MySQL + FastAPI) se lance avec les instructions de [platform/README.md](platform/README.md). Les secrets locaux vont dans `platform/backend/src/main/resources/application-local.yml` (modèle : `application-local.example.yml`).

## Licences et avertissement

- PAD-UFES-20 : CC BY 4.0 (Pacheco et al., *Data in Brief*, 2020).
- DermLIP : CC BY-NC-ND 4.0 — usage de recherche uniquement ; les poids ne sont pas redistribués ici.
- **Outil de recherche, pas un dispositif médical.** Il ne remplace pas l'avis d'un dermatologue.
