from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from concurrent.futures import ThreadPoolExecutor, as_completed
import uvicorn
import os

from data_loader import (
    get_swiss_market_data, get_world_market_data,
    get_etf_data, get_market_news,
    WORLD_TICKERS,
)
from analyzer import FeatureEngineer, MarketPredictor

app = FastAPI(title="Schweizer Markt Analyse AI")

BASE_DIR  = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
if not os.path.exists(STATIC_DIR):
    os.makedirs(STATIC_DIR)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
def read_root():
    return FileResponse(os.path.join(STATIC_DIR, 'index.html'))

# Währungs-Mapping: Ticker-Name → Währung
# Alles was nicht hier steht bekommt die default_currency des Endpoints
_CURRENCY_OVERRIDES = {
    "DAX":         "EUR",
    "Nikkei 225":  "JPY",
    "FTSE 100":    "GBP",
    "ASML":        "USD",   # US-ADR
}
# Alle Weltfirmen und ETFs sind USD
for _name in WORLD_TICKERS:
    _CURRENCY_OVERRIDES.setdefault(_name, "USD")

def _analyse_single(name: str, df, default_currency: str):
    """Analysiert ein einzelnes Instrument. Thread-safe."""
    try:
        df_processed = FeatureEngineer.add_technical_indicators(df)
        if len(df_processed) < 200:
            return None

        predictor = MarketPredictor()
        accuracy  = predictor.train(df_processed)
        trend, confidence = predictor.predict_next_day(df_processed)

        last_close = df_processed.iloc[-1]['Close']
        prev_close = df_processed.iloc[-2]['Close']
        change_pct = ((last_close - prev_close) / prev_close) * 100
        currency   = _CURRENCY_OVERRIDES.get(name, default_currency)

        return {
            "instrument": name,
            "price":      f"{last_close:.2f}",
            "currency":   currency,
            "change_pct": f"{change_pct:.2f}",
            "prediction": trend,
            "confidence": f"{confidence:.1%}",
            "accuracy":   f"{accuracy:.1%}",
            "signal": (
                "KAUFEN"   if trend == "STEIGEND" and confidence > 0.6 else
                "VERKAUFEN" if trend == "FALLEND"  and confidence > 0.6 else
                "HALTEN"
            )
        }
    except Exception as e:
        print(f"Fehler bei {name}: {e}")
        return None

def _process_market_data(market_data, default_currency="CHF"):
    if not market_data:
        return {"error": "Keine Daten verfügbar", "results": []}

    results = []
    # Cap worker count so we don't spawn too many threads
    workers = min(20, len(market_data))
    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {
            executor.submit(_analyse_single, name, df, default_currency): name
            for name, df in market_data.items()
        }
        for future in as_completed(futures):
            result = future.result()
            if result:
                results.append(result)

    results.sort(key=lambda x: x["instrument"])
    return {"results": results}

# ── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/api/market")
def get_market_analysis():
    print("Starte Schweizer Marktanalyse (20 Werte)...")
    return _process_market_data(get_swiss_market_data(), default_currency="CHF")

@app.get("/api/market/world")
def get_world_market_analysis():
    print("Starte globale Marktanalyse (Top 20)...")
    return _process_market_data(get_world_market_data(), default_currency="USD")

@app.get("/api/market/etf")
def get_etf_analysis():
    print("Starte ETF-Analyse (Top 20)...")
    return _process_market_data(get_etf_data(), default_currency="USD")

@app.get("/api/news")
def get_news():
    print("Lade News...")
    return {"news": get_market_news()}

if __name__ == "__main__":
    print("Starte Server auf http://localhost:8000")
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
