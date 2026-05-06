#!/bin/bash

# Prüfen ob venv existiert und aktivieren
if [ -d "../.venv" ]; then
    echo "Aktiviere Virtual Environment..."
    source "../.venv/bin/activate"
elif [ -d ".venv" ]; then
    echo "Aktiviere Virtual Environment..."
    source ".venv/bin/activate"
fi

# Python Version prüfen
if ! command -v python3 &> /dev/null; then
    echo "Python 3 ist nicht installiert."
    exit 1
fi

# Abhängigkeiten installieren
echo "Überprüfe Abhängigkeiten..."
python3 -m pip install -q -r requirements.txt || python3 -m pip install fastapi uvicorn yfinance pandas scikit-learn pandas-ta

# App starten
echo "==========================================="
echo "   Schweizer Markt Analyse AI - Starter"
echo "==========================================="
echo "Starte Server..."
echo "Öffnen Sie http://localhost:8000 in Ihrem Browser, sobald der Server läuft."
echo ""
python3 app.py
