"""Model classes and helpers shared with the notebooks (05_fusion / 06_xai_evaluation).

The final model was saved from a notebook: pickle refers to these classes as
``__main__.<name>``. ``register_for_unpickling()`` exposes them under that name
so ``joblib.load`` can rebuild the model.
"""
from functools import partial

import numpy as np
import pandas as pd
import torch
from sklearn.base import BaseEstimator, ClassifierMixin
from sklearn.compose import ColumnTransformer
from sklearn.decomposition import PCA
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GridSearchCV, GroupKFold, GroupShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

SEED = 42

NUM_COLS = ["age"]
BOOL_COLS = ["itch", "grew", "hurt", "changed", "bleed", "elevation"]
CAT_COLS = ["region"]
FEATURES = NUM_COLS + BOOL_COLS + CAT_COLS
PROFILE_NUM = ["fitspatrick", "diameter_1", "diameter_2"]
PROFILE_BOOL = ["smoke", "drink", "pesticide", "skin_cancer_history", "cancer_history"]
PROFILE_CAT = ["gender"]
PROFILE_COLS = PROFILE_NUM + PROFILE_BOOL + PROFILE_CAT

IMG_COLS = [f"img_{i}" for i in range(512)]
CONCEPT_COLS: list[str] = []          # filled in by the inference engine (depends on the retained concepts)


def set_concept_columns(names):
    CONCEPT_COLS.clear()
    CONCEPT_COLS.extend(f"c_{n}" for n in names)


def take_rows(X, idx):
    return X.iloc[idx] if isinstance(X, pd.DataFrame) else X[idx]


def fit_model(model, X, y, groups=None):
    needs_groups = isinstance(model, GridSearchCV) or getattr(model, "uses_groups", False)
    if needs_groups:
        assert groups is not None, "ce modèle a besoin des identifiants patients (groups)"
        return model.fit(X, y, groups=groups)
    return model.fit(X, y)


def make_clinical_preprocessor(num=NUM_COLS, bools=BOOL_COLS, cats=CAT_COLS):
    return ColumnTransformer([
        ("num", Pipeline([("imp", SimpleImputer(strategy="median")), ("scale", StandardScaler())]), num),
        ("bool", SimpleImputer(strategy="most_frequent"), bools),
        ("cat", Pipeline([("imp", SimpleImputer(strategy="most_frequent")),
                          ("ohe", OneHotEncoder(handle_unknown="ignore", sparse_output=False))]), cats),
    ])


def make_linear_fusion(clin=True, img=False, cpt=False, profile=False):
    blocks = []
    if clin:
        num, bools, cats = ((NUM_COLS + PROFILE_NUM, BOOL_COLS + PROFILE_BOOL, CAT_COLS + PROFILE_CAT)
                            if profile else (NUM_COLS, BOOL_COLS, CAT_COLS))
        blocks.append(("clin", make_clinical_preprocessor(num, bools, cats), num + bools + cats))
    if img:
        blocks.append(("img", Pipeline([("scale", StandardScaler()), ("pca", PCA(random_state=SEED))]), IMG_COLS))
    if cpt:
        blocks.append(("cpt", StandardScaler(), list(CONCEPT_COLS)))
    pipe = Pipeline([("prep", ColumnTransformer(blocks)), ("scale", StandardScaler()),
                     ("clf", LogisticRegression(class_weight="balanced", max_iter=5000))])
    grid = {"clf__C": [0.003, 0.01, 0.03, 0.1, 0.3, 1.0]}
    if img:
        grid["prep__img__pca__n_components"] = [16, 64, 128]
    return GridSearchCV(pipe, grid, cv=GroupKFold(n_splits=3), scoring="roc_auc", n_jobs=-1)


def _logit(p, eps=1e-6):
    p = np.clip(p, eps, 1 - eps)
    return np.log(p / (1 - p))


class LateFusion(BaseEstimator, ClassifierMixin):
    uses_groups = True

    def __init__(self, base_factories=(), n_inner=3):
        self.base_factories = base_factories
        self.n_inner = n_inner

    def fit(self, X, y, groups):
        y, groups = np.asarray(y), np.asarray(groups)
        Z = np.zeros((len(y), len(self.base_factories)))
        for tr, va in GroupKFold(n_splits=self.n_inner).split(X, y, groups):
            for j, (_, factory) in enumerate(self.base_factories):
                m = fit_model(factory(), take_rows(X, tr), y[tr], groups[tr])
                Z[va, j] = _logit(m.predict_proba(take_rows(X, va))[:, 1])
        self.meta_ = LogisticRegression(class_weight="balanced").fit(Z, y)
        self.bases_ = [fit_model(f(), X, y, groups) for _, f in self.base_factories]
        self.classes_ = np.array([0, 1])
        return self

    def predict_proba(self, X):
        Z = np.column_stack([_logit(m.predict_proba(X)[:, 1]) for m in self.bases_])
        return self.meta_.predict_proba(Z)


class _GatedNet(torch.nn.Module):
    def __init__(self, dims, hidden, dropout):
        super().__init__()
        self.encoders = torch.nn.ModuleList([
            torch.nn.Sequential(torch.nn.Linear(d, hidden), torch.nn.GELU(), torch.nn.Dropout(dropout)) for d in dims])
        self.gate = torch.nn.Linear(hidden * len(dims), len(dims))
        self.head = torch.nn.Sequential(torch.nn.LayerNorm(hidden), torch.nn.Linear(hidden, 1))

    def forward(self, xs):
        hs = [enc(x) for enc, x in zip(self.encoders, xs)]
        w = torch.softmax(self.gate(torch.cat(hs, dim=1)), dim=1)
        fused = sum(w[:, i:i + 1] * h for i, h in enumerate(hs))
        return self.head(fused).squeeze(1), w


class GatedFusion(BaseEstimator, ClassifierMixin):
    uses_groups = True
    MODALITIES = ("clinique", "image", "concepts")

    def __init__(self, hidden=32, dropout=0.3, lr=1e-3, weight_decay=1e-2, max_epochs=400,
                 patience=30, n_seeds=5, val_size=0.15, img_pca=64):
        self.hidden, self.dropout, self.lr, self.weight_decay = hidden, dropout, lr, weight_decay
        self.max_epochs, self.patience, self.n_seeds = max_epochs, patience, n_seeds
        self.val_size, self.img_pca = val_size, img_pca

    def _blocks(self):
        return [("clin", make_clinical_preprocessor(), FEATURES),
                ("img", Pipeline([("scale", StandardScaler()),
                                  ("pca", PCA(n_components=self.img_pca, random_state=SEED))]), IMG_COLS),
                ("cpt", StandardScaler(), list(CONCEPT_COLS))]

    def _transform(self, X):
        return [torch.tensor(np.asarray(p.transform(X[cols]), dtype=np.float32))
                for (_, _, cols), p in zip(self._blocks(), self.preps_)]

    def fit(self, X, y, groups):
        y = np.asarray(y, dtype=np.float32)
        tr, va = next(GroupShuffleSplit(n_splits=1, test_size=self.val_size, random_state=SEED).split(X, y, groups))
        Xtr, Xva = take_rows(X, tr), take_rows(X, va)
        self.preps_ = [p.fit(Xtr[cols]) for _, p, cols in self._blocks()]
        xtr, xva = self._transform(Xtr), self._transform(Xva)
        ytr, yva = torch.tensor(y[tr]), torch.tensor(y[va])
        loss_fn = torch.nn.BCEWithLogitsLoss(pos_weight=torch.tensor((1 - y[tr]).sum() / max(y[tr].sum(), 1.0)))
        self.nets_ = []
        for s in range(self.n_seeds):
            torch.manual_seed(SEED + s)
            net = _GatedNet([x.shape[1] for x in xtr], self.hidden, self.dropout)
            opt = torch.optim.AdamW(net.parameters(), lr=self.lr, weight_decay=self.weight_decay)
            best, best_state, wait = np.inf, None, 0
            for _ in range(self.max_epochs):
                net.train()
                opt.zero_grad()
                loss_fn(net(xtr)[0], ytr).backward()
                opt.step()
                net.eval()
                with torch.no_grad():
                    v = loss_fn(net(xva)[0], yva).item()
                if v < best - 1e-4:
                    best, wait = v, 0
                    best_state = {k: t.detach().clone() for k, t in net.state_dict().items()}
                else:
                    wait += 1
                    if wait >= self.patience:
                        break
            net.load_state_dict(best_state)
            net.eval()
            self.nets_.append(net)
        self.classes_ = np.array([0, 1])
        return self

    def predict_proba(self, X):
        xs = self._transform(X)
        with torch.no_grad():
            p = np.mean([torch.sigmoid(net(xs)[0]).numpy() for net in self.nets_], axis=0)
        return np.column_stack([1 - p, p])


# The model selected by the notebook's rule (section 5.3), rebuilt identically if needed
FACTORIES = {
    "E1a Clinique": lambda: make_linear_fusion(clin=True),
    "E3 Image DermLIP": lambda: make_linear_fusion(clin=False, img=True),
    "E5 Concepts": lambda: make_linear_fusion(clin=False, cpt=True),
    "E6a Précoce image+clinique": lambda: make_linear_fusion(clin=True, img=True),
    "E6b Tardive image+clinique": lambda: LateFusion((
        ("clinique", partial(make_linear_fusion, clin=True)),
        ("image", partial(make_linear_fusion, clin=False, img=True)))),
    "E7a Précoce image+concepts+clinique": lambda: make_linear_fusion(clin=True, img=True, cpt=True),
    "E7c Concepts+clinique": lambda: make_linear_fusion(clin=True, cpt=True),
    "E7b À porte (réseau)": lambda: GatedFusion(),
}


def register_for_unpickling():
    """Expose these classes as ``__main__.<name>`` (the name they were saved under in the notebook)."""
    import __main__
    for name, obj in {"make_linear_fusion": make_linear_fusion, "LateFusion": LateFusion,
                      "GatedFusion": GatedFusion, "_GatedNet": _GatedNet, "_logit": _logit,
                      "make_clinical_preprocessor": make_clinical_preprocessor,
                      "fit_model": fit_model, "take_rows": take_rows}.items():
        setattr(__main__, name, obj)
