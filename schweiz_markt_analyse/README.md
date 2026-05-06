# Schweizer Markt Analyse AI 🇨🇭📈

Eine KI-gestützte Anwendung, die historische Marktdaten analysiert und Vorhersagen für den Schweizer Aktienmarkt (SMI, Nestlé, Novartis, Roche) trifft.

## Features
- **Datenbeschaffung**: Lädt automatisch historische Kurse via `yfinance`.
- **Analyse**: Berechnet technische Indikatoren (SMA 50/200, RSI, MACD, Volatilität).
- **KI-Modell**: Trainiert einen Random Forest Klassifikator, um Trends vorherzusagen.
- **Reporting**: Gibt eine klare Kauf/Verkauf-Tendenz mit Wahrscheinlichkeit aus.

## Installation

1. Projektverzeichnis öffnen:
   ```bash
   cd /Users/carlklein/.gemini/antigravity/scratch/schweiz_markt_analyse
   ```

2. Abhängigkeiten installieren:
   ```bash
   pip install pandas yfinance scikit-learn matplotlib pandas-ta
   ```

## Nutzung

### Einfacher Start (Empfohlen)
Doppelklicken Sie auf `start_app.sh` oder führen Sie es im Terminal aus:
```bash
./start_app.sh
```

### Manueller Start
```bash
python3 app.py
```
Öffnen Sie dann `http://localhost:8000` im Browser.

## Beispiel Output
```
Instrument      | Kurs            | Vorhersage   | Sicherheit   | Genauigkeit (Backtest)
--------------------------------------------------------------------------------
SMI             | 11200.50 CHF    | STEIGEND     | 66.3%        | 55.8%               
Nestlé          | 98.40 CHF       | FALLEND      | 52.1%        | 51.2%               
```

## Disclaimer
Dies ist ein experimentelles Projekt und keine Finanzberatung! Handeln Sie auf eigenes Risiko.
