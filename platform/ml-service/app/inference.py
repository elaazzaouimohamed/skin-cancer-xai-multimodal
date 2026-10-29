"""Inference engine: DermLIP + the final model selected in notebook 05.

Loading strategy (most robust first):
  1. ``local_model.joblib`` — model already rebuilt on this machine (same library versions);
  2. ``final_model.joblib`` — model saved on Kaggle (may fail if the scikit-learn/numpy versions differ);
  3. rebuild from the Kaggle features (``features_dermlip_vitb16.npy`` + ``splits.csv``) with the same
     deterministic procedure as the notebook, then save ``local_model.joblib``.
"""
from __future__ import annotations

import base64
import io
import json
import logging
import os
import time
import warnings
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import torch
from PIL import Image

from . import pfa_models as pm

log = logging.getLogger("ml-service")

REGIONS = ["ABDOMEN", "ARM", "BACK", "CHEST", "EAR", "FACE", "FOOT", "FOREARM", "HAND", "LIP",
           "NECK", "NOSE", "SCALP", "THIGH"]
CLIN_FR = {"age": "âge", "itch": "démangeaison", "grew": "a grossi", "hurt": "douleur",
           "changed": "a changé", "bleed": "saignement", "elevation": "relief", "region": "localisation"}
REGION_FR = {"ABDOMEN": "abdomen", "ARM": "bras", "BACK": "dos", "CHEST": "thorax", "EAR": "oreille",
             "FACE": "visage", "FOOT": "pied", "FOREARM": "avant-bras", "HAND": "main", "LIP": "lèvre",
             "NECK": "cou", "NOSE": "nez", "SCALP": "cuir chevelu", "THIGH": "cuisse"}
GRID = 8


class Engine:
    def __init__(self, artifacts_dir: Path, dataset_csv: Path, dermlip_id: str):
        self.artifacts_dir = Path(artifacts_dir)
        self.dataset_csv = Path(dataset_csv)
        self.dermlip_id = dermlip_id
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        torch.set_num_threads(max(1, os.cpu_count() or 1))
        pm.register_for_unpickling()

        self.summary = self._read_json("outputs/reports/05_synthese.json") or {}
        self._load_concepts()
        self._load_dermlip()
        self._load_model()
        log.info("Moteur prêt : modèle=%s, seuil=%.3f, appareil=%s", self.model_name, self.threshold, self.device)

    # ------------------------------------------------------------------ loading
    def _path(self, *candidates: str) -> Path | None:
        for c in candidates:
            for base in (self.artifacts_dir, self.artifacts_dir / "outputs", self.artifacts_dir / "data"):
                p = base / c
                if p.exists():
                    return p
            hits = list(self.artifacts_dir.rglob(Path(c).name))
            if hits:
                return hits[0]
        return None

    def _read_json(self, rel: str):
        p = self._path(rel)
        return json.loads(p.read_text(encoding="utf8")) if p else None

    def _load_concepts(self):
        p = self._path("data/processed/concept_text_embeddings.npz")
        if p is None:
            raise FileNotFoundError("concept_text_embeddings.npz introuvable dans ARTIFACTS_DIR")
        bank = np.load(p, allow_pickle=True)
        names = [str(n) for n in bank["names"]]
        self.concept_labels = dict(zip(names, [str(x) for x in bank["labels_fr"]]))
        sel = self._path("data/processed/concepts_selected.csv")
        if sel is not None:
            table = pd.read_csv(sel)
            kept = table.loc[table["retenu"].astype(bool), "concept"].tolist()
        else:
            kept = [n for n in names if n != "skin_marker_ink"]
        self.concept_names = kept
        idx = {n: i for i, n in enumerate(names)}
        self.cpt_emb = bank["concept_emb"][[idx[n] for n in kept]]
        self.ink_emb = bank["concept_emb"][idx["skin_marker_ink"]] if "skin_marker_ink" in idx else None
        self.ref_emb = bank["ref_emb"]
        pm.set_concept_columns(kept)

        self.concept_mean = self.concept_std = None
        scores = self._path("data/processed/concept_scores.csv")
        if scores is not None:
            s = pd.read_csv(scores)
            cols = [c for c in kept if c in s.columns]
            if len(cols) == len(kept):
                self.concept_mean = s[kept].mean().to_numpy()
                self.concept_std = s[kept].std().replace(0, 1).to_numpy()

    def _load_dermlip(self):
        import open_clip
        model, _, preprocess = open_clip.create_model_and_transforms(self.dermlip_id)
        self.clip = model.to(self.device).eval()
        self.preprocess = preprocess
        norm = next(t for t in preprocess.transforms if t.__class__.__name__ == "Normalize")
        self.mean = torch.tensor(norm.mean).view(3, 1, 1)
        self.std = torch.tensor(norm.std).view(3, 1, 1)

    def _load_model(self):
        local = self.artifacts_dir / "local_model.joblib"
        kaggle = self._path("outputs/checkpoints/final_model.joblib")
        bundle = None
        for path, origin in ((local, "local"), (kaggle, "kaggle")):
            if path is not None and path.exists():
                try:
                    with warnings.catch_warnings(record=True) as caught:
                        warnings.simplefilter("always")
                        candidate = joblib.load(path)
                    mismatch = [w for w in caught if w.category.__name__ == "InconsistentVersionWarning"]
                    if mismatch:  # model saved with another scikit-learn version: we prefer rebuilding it
                        log.warning("%s enregistré avec une autre version de scikit-learn (%s) : reconstruction.",
                                    path.name, mismatch[0].message)
                        continue
                    bundle = candidate
                    self.model_origin = f"{origin} ({path.name})"
                    break
                except Exception as e:  # incompatible library versions, etc.
                    log.warning("Échec du chargement de %s : %s", path, e)
        if bundle is None:
            bundle = self._rebuild()
            joblib.dump(bundle, local)
            self.model_origin = "reconstruit localement à partir des caractéristiques Kaggle"

        self.model = bundle["modele"]
        self.model_name = bundle["nom"]
        self.thresholds = {k: float(v) for k, v in bundle["seuils"].items()}
        self.threshold_name = bundle.get("seuil_principal", "Triage sensibilité ≥ 90 % (dev)")
        self.threshold = self.thresholds[self.threshold_name]
        self.ref_clin = bundle["reference_clinique"]
        self.ref_cpt = bundle["reference_concepts"]
        self.ref_img = np.asarray(bundle["reference_image"])

    def _rebuild(self) -> dict:
        """Refit the retained model on the development set (same split, same procedure as notebook 05)."""
        log.info("Reconstruction du modèle final à partir des caractéristiques…")
        feats = np.load(self._path("data/processed/features_dermlip_vitb16.npy"))
        ids = pd.read_csv(self._path("data/processed/features_dermlip_vitb16_ids.csv"))["img_id"]
        splits = pd.read_csv(self._path("data/processed/splits.csv"))
        meta = pd.read_csv(self.dataset_csv, na_values=["UNK"])
        df = splits.merge(meta[["img_id"] + pm.FEATURES + pm.PROFILE_COLS], on="img_id", how="left")
        to_float = {True: 1.0, False: 0.0, "True": 1.0, "False": 0.0}
        for c in pm.BOOL_COLS + pm.PROFILE_BOOL:
            df[c] = df[c].map(to_float)
        dev = df[df["split"] == "train"].reset_index(drop=True)
        index = pd.Series(np.arange(len(ids)), index=ids.to_numpy())
        emb = feats[index.loc[dev["img_id"]].to_numpy()]
        X = self._frame(dev[pm.FEATURES + pm.PROFILE_COLS].reset_index(drop=True), emb)
        name = self.summary.get("modele_retenu", "E6b Tardive image+clinique")
        model = pm.fit_model(pm.FACTORIES[name](), X, dev["label"].to_numpy(), dev["patient_id"].to_numpy())
        seuils = self.summary.get("seuils") or {"Triage sensibilité ≥ 90 % (dev)": 0.375}
        ref = {c: float(X[c].median()) for c in pm.NUM_COLS}
        ref.update({c: X[c].mode().iloc[0] for c in pm.BOOL_COLS + pm.CAT_COLS})
        return {"nom": name, "modele": model, "seuils": seuils,
                "seuil_principal": "Triage sensibilité ≥ 90 % (dev)",
                "reference_clinique": ref,
                "reference_concepts": X[pm.CONCEPT_COLS].mean().to_dict(),
                "reference_image": X[pm.IMG_COLS].mean().to_numpy()}

    # ------------------------------------------------------------------ features
    def _concept_scores(self, emb: np.ndarray) -> np.ndarray:
        return emb @ self.cpt_emb.T - (emb @ self.ref_emb)[:, None]

    def _frame(self, clin: pd.DataFrame, emb: np.ndarray) -> pd.DataFrame:
        img = pd.DataFrame(emb, columns=pm.IMG_COLS)
        cpt = pd.DataFrame(self._concept_scores(emb), columns=pm.CONCEPT_COLS)
        return pd.concat([clin.reset_index(drop=True), img, cpt], axis=1)

    @staticmethod
    def clinical_frame(clinical: dict, n: int = 1) -> pd.DataFrame:
        row = {c: np.nan for c in pm.FEATURES + pm.PROFILE_COLS}
        row["age"] = float(clinical["age"]) if clinical.get("age") not in (None, "") else np.nan
        region = str(clinical.get("region") or "").upper()
        row["region"] = region if region in REGIONS else np.nan
        for c in pm.BOOL_COLS:
            v = clinical.get(c)
            row[c] = np.nan if v is None else (1.0 if v in (True, 1, "1", "true", "oui") else 0.0)
        frame = pd.DataFrame([row] * n)
        for c in pm.NUM_COLS + pm.BOOL_COLS + pm.PROFILE_NUM + pm.PROFILE_BOOL:
            frame[c] = frame[c].astype(float)
        for c in pm.CAT_COLS + pm.PROFILE_CAT:
            frame[c] = frame[c].astype(object)
        return frame

    @torch.no_grad()
    def _encode(self, tensors: list[torch.Tensor], batch: int = 16) -> np.ndarray:
        out = []
        for s in range(0, len(tensors), batch):
            e = self.clip.encode_image(torch.stack(tensors[s:s + batch]).to(self.device)).float()
            out.append(torch.nn.functional.normalize(e, dim=-1).cpu().numpy())
        return np.concatenate(out)

    def _proba(self, X: pd.DataFrame) -> np.ndarray:
        return self.model.predict_proba(X)[:, 1]

    # ------------------------------------------------------------------ explanations
    def _contributions(self, x: pd.DataFrame, clinical_values: dict) -> list[dict]:
        base = pm._logit(self._proba(x))[0]
        variants, meta = [], []
        for c in pm.FEATURES:
            v = x.copy()
            v[c] = self.ref_clin[c]
            variants.append(v)
            meta.append(("clinique", c, CLIN_FR[c], self._value_fr(c, clinical_values.get(c))))
        for n, c in zip(self.concept_names, pm.CONCEPT_COLS):
            v = x.copy()
            v[c] = self.ref_cpt[c]
            variants.append(v)
            meta.append(("concept", n, f"concept « {self.concept_labels.get(n, n)} »", None))
        v = x.copy()
        v.loc[:, pm.IMG_COLS] = self.ref_img.reshape(1, -1)
        variants.append(v)
        meta.append(("image", "image", "aspect global de l'image", None))
        delta = base - pm._logit(self._proba(pd.concat(variants, ignore_index=True)))
        rows = [{"type": t, "key": k, "label": lab, "value": val, "contribution": round(float(d), 4)}
                for (t, k, lab, val), d in zip(meta, delta)]
        rows = [r for r in rows if abs(r["contribution"]) >= 1e-3]
        return sorted(rows, key=lambda r: -abs(r["contribution"]))

    @staticmethod
    def _value_fr(col: str, value) -> str:
        if value is None or (isinstance(value, float) and np.isnan(value)) or value == "":
            return "non renseigné"
        if col == "age":
            return f"{float(value):.0f} ans"
        if col == "region":
            return REGION_FR.get(str(value).upper(), str(value).lower())
        return "oui" if value in (True, 1, 1.0, "1", "true", "oui") else "non"

    def _top_concepts(self, emb: np.ndarray, k: int = 5) -> list[dict]:
        s = self._concept_scores(emb)[0]
        z = (s - self.concept_mean) / self.concept_std if self.concept_mean is not None else (s - s.mean()) / (s.std() or 1)
        order = np.argsort(-z)[:k]
        return [{"name": self.concept_names[i], "label": self.concept_labels.get(self.concept_names[i], self.concept_names[i]),
                 "z": round(float(z[i]), 2)} for i in order]

    def _occlusion(self, x: torch.Tensor, clin: pd.DataFrame):
        step = x.shape[1] // GRID
        variants = [x]
        for i in range(GRID):
            for j in range(GRID):
                v = x.clone()
                v[:, i * step:(i + 1) * step, j * step:(j + 1) * step] = 0.0
                variants.append(v)
        emb = self._encode(variants)
        p = self._proba(self._frame(pd.concat([clin] * len(emb), ignore_index=True), emb))
        return (p[0] - p[1:]).reshape(GRID, GRID)

    def _to_rgb(self, x: torch.Tensor) -> np.ndarray:
        return ((x * self.std + self.mean).clamp(0, 1).permute(1, 2, 0).numpy() * 255).astype(np.uint8)

    @staticmethod
    def _png_b64(arr: np.ndarray) -> str:
        buf = io.BytesIO()
        Image.fromarray(arr).save(buf, format="PNG")
        return base64.b64encode(buf.getvalue()).decode("ascii")

    def _overlay(self, rgb: np.ndarray, heat: np.ndarray) -> np.ndarray:
        size = rgb.shape[0]
        vmax = max(float(np.abs(heat).max()), 1e-6)
        h = np.kron(heat / vmax, np.ones((size // GRID, size // GRID)))
        h = np.pad(h, ((0, size - h.shape[0]), (0, size - h.shape[1])))
        color = np.zeros_like(rgb, dtype=float)
        color[..., 0] = np.where(h > 0, 220, 30)          # rouge : pousse vers « cancer »
        color[..., 2] = np.where(h > 0, 40, 220)          # bleu : pousse vers « non-cancer »
        color[..., 1] = 40
        alpha = (np.abs(h) * 0.6)[..., None]
        return (rgb * (1 - alpha) + color * alpha).astype(np.uint8)

    @staticmethod
    def _location_fr(heat: np.ndarray) -> str:
        i, j = np.unravel_index(np.argmax(heat), heat.shape)
        vert = ["en haut", "au centre", "en bas"][min(2, i * 3 // GRID)]
        horiz = ["à gauche", "au centre", "à droite"][min(2, j * 3 // GRID)]
        return "au centre de l'image" if vert == horiz == "au centre" else f"{vert} {horiz} de l'image"

    def _template_report(self, p: float, decision: bool, contribs: list[dict], location: str | None) -> str:
        def phrase(r):
            return (f"{r['label']} : {r['value']} ({r['contribution']:+.2f})" if r["type"] == "clinique"
                    else f"{r['label']} ({r['contribution']:+.2f})")
        plus = [phrase(r) for r in contribs if r["contribution"] > 0.05][:3]
        minus = [phrase(r) for r in contribs if r["contribution"] < -0.05][:2]
        lines = [
            f"Probabilité estimée de cancer : {p:.2f} (seuil de triage {self.threshold:.2f}).",
            "Conclusion du modèle : " + ("suspicion de cancer, avis dermatologique recommandé." if decision
                                         else "pas de signe fort de cancer selon le modèle, surveillance selon avis médical."),
            "Éléments en faveur : " + ("; ".join(plus) if plus else "aucun élément marquant") + ".",
            "Éléments en défaveur : " + ("; ".join(minus) if minus else "aucun élément marquant") + ".",
        ]
        if location:
            lines.append(f"Zone de l'image la plus déterminante : {location}.")
        lines.append("Avertissement : outil d'aide à la décision ; il ne remplace ni l'examen clinique ni la biopsie.")
        return "\n".join(lines)

    # ------------------------------------------------------------------ public API
    def predict(self, image_bytes: bytes, clinical: dict, occlusion: bool = True) -> dict:
        t0 = time.time()
        with Image.open(io.BytesIO(image_bytes)) as im:
            x = self.preprocess(im.convert("RGB"))
        clin = self.clinical_frame(clinical)
        emb = self._encode([x])
        X = self._frame(clin, emb)
        p = float(self._proba(X)[0])
        decision = p >= self.threshold
        contribs = self._contributions(X, clinical)
        concepts = self._top_concepts(emb)

        ink_score = None
        if self.ink_emb is not None:
            ink_score = round(float(emb[0] @ self.ink_emb - emb[0] @ self.ref_emb), 4)

        heat_png = location = None
        heat = None
        if occlusion:
            heat = self._occlusion(x, clin)
            location = self._location_fr(heat)
            heat_png = self._png_b64(self._overlay(self._to_rgb(x), heat))

        return {
            "probability": round(p, 4),
            "decision": "suspicion_cancer" if decision else "pas_de_signe_fort",
            "threshold": round(self.threshold, 4),
            "thresholdName": self.threshold_name,
            "thresholds": {k: round(v, 4) for k, v in self.thresholds.items()},
            "modelName": self.model_name,
            "contributions": contribs[:10],
            "concepts": concepts,
            "location": location,
            "imagePng": self._png_b64(self._to_rgb(x)),
            "heatmapPng": heat_png,
            "heatmapGrid": None if heat is None else np.round(heat, 4).tolist(),
            "inkScore": ink_score,
            "templateReport": self._template_report(p, decision, contribs, location),
            "inferenceMs": int((time.time() - t0) * 1000),
        }

    def info(self) -> dict:
        return {
            "modelName": self.model_name,
            "modelOrigin": self.model_origin,
            "encoder": self.dermlip_id,
            "device": self.device,
            "threshold": self.threshold,
            "thresholdName": self.threshold_name,
            "thresholds": self.thresholds,
            "concepts": [{"name": n, "label": self.concept_labels.get(n, n)} for n in self.concept_names],
            "regions": [{"code": r, "label": REGION_FR[r]} for r in REGIONS],
            "summary": self.summary,
        }
