import sys
from data_loader import get_swiss_market_data
from analyzer import FeatureEngineer, MarketPredictor
import pandas as pd

def main():
    print("=== Schweizer Markt Analyse AI ===")
    print("Initialisiere System...")
    
    # 1. Daten laden
    print("\n[1/3] Lade historische Marktdaten...")
    market_data = get_swiss_market_data()
    
    if not market_data:
        print("Fehler: Keine Daten geladen. Überprüfe deine Internetverbindung oder die Ticker-Symbole.")
        sys.exit(1)
        
    # 2. Analyse & Modellierung
    print("\n[2/3] Analysiere Daten und trainiere KI-Modelle...")
    
    results = []
    
    for name, df in market_data.items():
        print(f"  -> Verarbeite {name}...")
        
        # Feature Engineering
        try:
            df_processed = FeatureEngineer.add_technical_indicators(df)
            
            if len(df_processed) < 200:
                print(f"     Warnung: Zu wenig Daten für {name} (benötige >200 Tage für SMA_200). Überspringe.")
                continue
                
            # Modell Training
            predictor = MarketPredictor()
            accuracy = predictor.train(df_processed)
            
            # Vorhersage
            trend, confidence = predictor.predict_next_day(df_processed)
            
            results.append({
                "Instrument": name,
                "Vorhersage": trend,
                "Wahrscheinlichkeit": f"{confidence:.1%}",
                "Modell-Genauigkeit": f"{accuracy:.1%}",
                "Aktueller Kurs": f"{df_processed.iloc[-1]['Close']:.2f} CHF"
            })
            
        except Exception as e:
            print(f"     Fehler bei der Analyse von {name}: {e}")

    # 3. Reporting
    print("\n[3/3] Ergebnisse:")
    print("-" * 80)
    print(f"{'Instrument':<15} | {'Kurs':<15} | {'Vorhersage':<12} | {'Sicherheit':<12} | {'Genauigkeit (Backtest)':<20}")
    print("-" * 80)
    
    for res in results:
        print(f"{res['Instrument']:<15} | {res['Aktueller Kurs']:<15} | {res['Vorhersage']:<12} | {res['Wahrscheinlichkeit']:<12} | {res['Modell-Genauigkeit']:<20}")
    print("-" * 80)
    print("Hinweis: Dies sind KI-gestützte Wahrscheinlichkeiten, keine Finanzberatung!")

if __name__ == "__main__":
    main()
