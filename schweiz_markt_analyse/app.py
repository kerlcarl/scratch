from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from typing import List, Dict, Any
from concurrent.futures import ThreadPoolExecutor, as_completed
import uvicorn
import os

from data_loader import get_swiss_market_data, get_world_market_data, get_market_news
from analyzer import FeatureEngineer, MarketPredictor

app = FastAPI(title="Schweizer Markt Analyse AI")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

# Statische Dateien servieren (Frontend)
# Wir gehen davon aus, dass der Ordner 'static' existiert
if not os.path.exists(STATIC_DIR):
    os.makedirs(STATIC_DIR)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
def read_root():
    return FileResponse(os.path.join(STATIC_DIR, 'index.html'))

CURRENCY_MAP = {
    "S&P 500": "USD", "NASDAQ": "USD",
    "DAX": "EUR", "Nikkei 225": "JPY", "FTSE 100": "GBP"
}

def _analyse_single(name: str, df, default_currency: str):
    """Analysiert ein einzelnes Instrument — geeignet für parallele Ausführung."""
    try:
        df_processed = FeatureEngineer.add_technical_indicators(df)
        if len(df_processed) < 200:
            return None

        predictor = MarketPredictor()
        accuracy = predictor.train(df_processed)
        trend, confidence = predictor.predict_next_day(df_processed)

        last_close = df_processed.iloc[-1]['Close']
        prev_close = df_processed.iloc[-2]['Close']
        change_pct = ((last_close - prev_close) / prev_close) * 100
        currency = CURRENCY_MAP.get(name, default_currency)

        return {
            "instrument": name,
            "price": f"{last_close:.2f}",
            "currency": currency,
            "change_pct": f"{change_pct:.2f}",
            "prediction": trend,
            "confidence": f"{confidence:.1%}",
            "accuracy": f"{accuracy:.1%}",
            "signal": (
                "KAUFEN" if trend == "STEIGEND" and confidence > 0.6
                else "VERKAUFEN" if trend == "FALLEND" and confidence > 0.6
                else "HALTEN"
            )
        }
    except Exception as e:
        print(f"Fehler bei {name}: {e}")
        return None

def _process_market_data(market_data, default_currency="CHF"):
    if not market_data:
        return {"error": "Keine Daten verfügbar", "results": []}

    results = []
    with ThreadPoolExecutor(max_workers=len(market_data)) as executor:
        futures = {
            executor.submit(_analyse_single, name, df, default_currency): name
            for name, df in market_data.items()
        }
        for future in as_completed(futures):
            result = future.result()
            if result:
                results.append(result)

    # Stabile Reihenfolge
    results.sort(key=lambda x: x["instrument"])
    return {"results": results}

@app.get("/api/market")
def get_market_analysis():
    print("Starte Marktanalyse...")
    market_data = get_swiss_market_data()
    return _process_market_data(market_data, default_currency="CHF")

@app.get("/api/market/world")
def get_world_market_analysis():
    print("Starte globale Marktanalyse...")
    market_data = get_world_market_data()
    return _process_market_data(market_data)

@app.get("/api/news")
def get_news():
    print("Lade News...")
    news = get_market_news()
    return {"news": news}

if __name__ == "__main__":
    print("Starte Server auf http://localhost:8000")
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
