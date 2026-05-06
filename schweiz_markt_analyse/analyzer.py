import pandas as pd
import pandas_ta as ta
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
import numpy as np

class FeatureEngineer:
    """Berechnet technische Indikatoren für die Analyse."""
    
    @staticmethod
    def add_technical_indicators(df):
        """
        Fügt technische Indikatoren zum DataFrame hinzu.
        Erwartet einen DataFrame mit 'Close', 'High', 'Low', 'Volume'.
        """
        df = df.copy()
        
        # 1. Gleitende Durchschnitte (SMA)
        df['SMA_50'] = ta.sma(df['Close'], length=50)
        df['SMA_200'] = ta.sma(df['Close'], length=200)
        
        # 2. RSI (Relative Strength Index)
        df['RSI'] = ta.rsi(df['Close'], length=14)
        
        # 3. MACD
        macd = ta.macd(df['Close'])
        df = pd.concat([df, macd], axis=1)
        
        # 4. Volatilität (ATR)
        df['ATR'] = ta.atr(df['High'], df['Low'], df['Close'], length=14)
        
        # Zielvariable: Wird der Preis morgen steigen? (1 = Ja, 0 = Nein)
        # Wir verschieben den Close um -1 (Zukunft), um zu sehen was morgen passiert
        df['Target'] = (df['Close'].shift(-1) > df['Close']).astype(int)
        
        # NaN Werte entfernen (durch Indikatoren-Berechnung am Anfang)
        df.dropna(inplace=True)
        
        return df

class MarketPredictor:
    """Klasse zum Trainieren und Vorhersagen von Marktbewegungen."""
    
    def __init__(self):
        self.model = RandomForestClassifier(n_estimators=100, min_samples_split=100, random_state=42)
        self.features = ['SMA_50', 'SMA_200', 'RSI', 'ATR', 'MACD_12_26_9', 'MACDh_12_26_9', 'MACDs_12_26_9']
        
    def train(self, df):
        """Trainiert das Modell mit historischen Daten."""
        X = df[self.features]
        y = df['Target']
        
        # Split in Training und Test
        # Da es Zeitreihendaten sind, dürfen wir NICHT random shuffeln!
        # Wir nehmen die ersten 80% zum Trainieren und die letzten 20% zum Testen
        split = int(len(df) * 0.8)
        X_train, X_test = X.iloc[:split], X.iloc[split:]
        y_train, y_test = y.iloc[:split], y.iloc[split:]
        
        self.model.fit(X_train, y_train)
        
        # Evaluation
        preds = self.model.predict(X_test)
        accuracy = accuracy_score(y_test, preds)
        print(f"Modell Genauigkeit (Test-Set): {accuracy:.2f}")
        # print(classification_report(y_test, preds))
        
        return accuracy

    def predict_next_day(self, df):
        """Vorhersage für den nächsten Handelstag basierend auf den aktuellsten Daten."""
        # Wir nehmen die allerletzte Zeile (heute)
        last_row = df.iloc[[-1]][self.features]
        
        prediction = self.model.predict(last_row)[0]
        proba = self.model.predict_proba(last_row)[0]
        
        trend = "STEIGEND" if prediction == 1 else "FALLEND"
        confidence = proba[prediction]
        
        return trend, confidence

if __name__ == "__main__":
    # Kleiner Test, wenn Module direkt aufgerufen wird
    # Erfordert data_loader.py im selben Verzeichnis
    try:
        from data_loader import get_swiss_market_data
        data = get_swiss_market_data()
        
        if "SMI" in data:
            print("Analysiere SMI...")
            df = data["SMI"]
            
            # Features hinzufügen
            df_processed = FeatureEngineer.add_technical_indicators(df)
            
            # Modell trainieren
            predictor = MarketPredictor()
            predictor.train(df_processed)
            
            # Vorhersage
            trend, conf = predictor.predict_next_day(df_processed)
            print(f"Vorhersage für morgen: {trend} (Sicherheit: {conf:.2%})")
            
    except ImportError:
        print("data_loader.py nicht gefunden oder Fehler beim Import.")
