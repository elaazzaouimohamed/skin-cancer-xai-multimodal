"""ML service (FastAPI): exposes the trained model to the Spring Boot backend.

Start (from platform/ml-service):
    uvicorn app.main:app --host 127.0.0.1 --port 8000
"""
from __future__ import annotations

import json
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile

from .inference import Engine

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s : %(message)s")
log = logging.getLogger("ml-service")

PROJECT_ROOT = Path(__file__).resolve().parents[3]
ARTIFACTS_DIR = Path(os.getenv("ARTIFACTS_DIR", PROJECT_ROOT / "outputs" / "kaggle_v2"))
DATASET_CSV = Path(os.getenv("DATASET_CSV", PROJECT_ROOT / "zr7vgbcyr2-1" / "metadata.csv"))
DERMLIP_ID = os.getenv("DERMLIP_ID", "hf-hub:redlessone/DermLIP_ViT-B-16")
MAX_IMAGE_BYTES = 15 * 1024 * 1024

state: dict = {"engine": None, "error": None}


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        state["engine"] = Engine(ARTIFACTS_DIR, DATASET_CSV, DERMLIP_ID)
    except Exception as e:  # the service still starts and reports the error on /health
        log.exception("Échec du chargement du moteur")
        state["error"] = f"{type(e).__name__}: {e}"
    yield


app = FastAPI(title="PFA — service d'inférence", version="1.0.0", lifespan=lifespan)


def engine() -> Engine:
    if state["engine"] is None:
        raise HTTPException(status_code=503, detail=f"Modèle non chargé : {state['error']}")
    return state["engine"]


@app.get("/health")
def health():
    eng = state["engine"]
    return {"status": "ok" if eng else "error", "modelLoaded": eng is not None,
            "modelName": eng.model_name if eng else None, "device": eng.device if eng else None,
            "error": state["error"], "artifactsDir": str(ARTIFACTS_DIR)}


@app.get("/model-info")
def model_info():
    return engine().info()


@app.post("/predict")
async def predict(image: UploadFile = File(...), clinical: str = Form("{}"), occlusion: bool = Form(True)):
    data = await image.read()
    if not data:
        raise HTTPException(status_code=400, detail="Image vide")
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image trop volumineuse (15 Mo maximum)")
    try:
        clin = json.loads(clinical or "{}")
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Champ « clinical » invalide : {e}") from e
    try:
        return engine().predict(data, clin, occlusion=occlusion)
    except HTTPException:
        raise
    except Exception as e:
        log.exception("Erreur d'inférence")
        raise HTTPException(status_code=500, detail=f"Erreur d'inférence : {e}") from e
