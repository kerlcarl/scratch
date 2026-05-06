import yfinance as yf
import pandas as pd
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
import time

# ── Ticker-Konfigurationen ──────────────────────────────────────────────────

# SMI 20 – alle 20 Komponenten des Swiss Market Index
SWISS_TICKERS = {
    "SMI Index":        "^SSMI",
    "Nestlé":           "NESN.SW",
    "Novartis":         "NOVN.SW",
    "Roche":            "ROG.SW",
    "ABB":              "ABBN.SW",
    "UBS Group":        "UBSG.SW",
    "Zurich Insurance": "ZURN.SW",
    "Lonza":            "LONN.SW",
    "Richemont":        "CFR.SW",
    "Swiss Re":         "SREN.SW",
    "Partners Group":   "PGHN.SW",
    "Givaudan":         "GIVN.SW",
    "Holcim":           "HOLN.SW",
    "Alcon":            "ALC.SW",
    "Sika":             "SIKA.SW",
    "Geberit":          "GEBN.SW",
    "Kühne+Nagel":      "KNIN.SW",
    "Sonova":           "SOON.SW",
    "Swisscom":         "SCMN.SW",
    "Straumann":        "STMN.SW",
    "Logitech":         "LOGN.SW",
}

# Top 20 Unternehmen weltweit nach Marktkapitalisierung
WORLD_TICKERS = {
    "Apple":             "AAPL",
    "Microsoft":         "MSFT",
    "NVIDIA":            "NVDA",
    "Alphabet (Google)": "GOOGL",
    "Amazon":            "AMZN",
    "Meta":              "META",
    "Tesla":             "TSLA",
    "Berkshire Hathaway":"BRK-B",
    "TSMC":              "TSM",
    "Eli Lilly":         "LLY",
    "Broadcom":          "AVGO",
    "JPMorgan Chase":    "JPM",
    "Visa":              "V",
    "ExxonMobil":        "XOM",
    "Netflix":           "NFLX",
    "ASML":              "ASML",
    "Walmart":           "WMT",
    "UnitedHealth":      "UNH",
    "Johnson & Johnson": "JNJ",
    "Oracle":            "ORCL",
}

# Top 20 globale ETFs / Indexfonds nach verwaltetem Vermögen (AUM)
ETF_TICKERS = {
    "SPDR S&P 500 (SPY)":          "SPY",
    "iShares Core S&P 500 (IVV)":  "IVV",
    "Vanguard S&P 500 (VOO)":      "VOO",
    "Vanguard Total Market (VTI)":  "VTI",
    "Invesco NASDAQ-100 (QQQ)":    "QQQ",
    "Vanguard Dev. Markets (VEA)":  "VEA",
    "iShares MSCI EAFE (IEFA)":    "IEFA",
    "Vanguard Emerg. Mkts (VWO)":  "VWO",
    "iShares MSCI EM (IEMG)":      "IEMG",
    "Vanguard Total Bond (BND)":   "BND",
    "iShares Core Bond (AGG)":     "AGG",
    "SPDR Gold Shares (GLD)":      "GLD",
    "Vanguard Growth (VUG)":       "VUG",
    "iShares Russell 1000 (IWF)":  "IWF",
    "iShares Core Mid-Cap (IJH)":  "IJH",
    "Vanguard Value (VTV)":        "VTV",
    "iShares Russell 2000 (IWM)":  "IWM",
    "Schwab US Broad Mkt (SCHB)":  "SCHB",
    "Financial Sector (XLF)":      "XLF",
    "iShares MSCI World (URTH)":   "URTH",
}

# Rückwärtskompatibilität – alte Namen bleiben nutzbar
TICKERS = SWISS_TICKERS

# ── Cache ───────────────────────────────────────────────────────────────────

_cache: dict = {}
CACHE_TTL = 900  # 15 Minuten

# ── Datenabruf ──────────────────────────────────────────────────────────────

def fetch_data(ticker_symbol, period="5y", interval="1d"):
    """Lädt historische Daten für einen Ticker (mit In-Memory-Cache)."""
    cache_key = f"{ticker_symbol}_{period}_{interval}"
    now = time.time()

    if cache_key in _cache:
        df_cached, ts = _cache[cache_key]
        if now - ts < CACHE_TTL:
            print(f"Cache-Hit für {ticker_symbol}")
            return df_cached

    print(f"Lade Daten für {ticker_symbol}...")
    try:
        ticker = yf.Ticker(ticker_symbol)
        df = ticker.history(period=period, interval=interval)
    except Exception as e:
        print(f"Fehler beim Abruf von {ticker_symbol}: {e}")
        return None

    if df.empty:
        print(f"ACHTUNG: Keine Daten für {ticker_symbol}!")
        _cache[cache_key] = (None, now)
        return None

    print(f"  -> {len(df)} Datensätze für {ticker_symbol} geladen.")
    _cache[cache_key] = (df, now)
    return df

def _fetch_parallel(tickers_dict, max_workers=10):
    """Lädt mehrere Ticker parallel."""
    market_data = {}
    with ThreadPoolExecutor(max_workers=min(max_workers, len(tickers_dict))) as executor:
        futures = {executor.submit(fetch_data, symbol): name
                   for name, symbol in tickers_dict.items()}
        for future in as_completed(futures):
            name = futures[future]
            try:
                df = future.result()
                if df is not None:
                    market_data[name] = df
            except Exception as e:
                print(f"Fehler beim Laden von {name}: {e}")
    return market_data

def get_swiss_market_data():
    """Lädt alle 20 Schweizer SMI-Werte (parallel)."""
    return _fetch_parallel(SWISS_TICKERS)

def get_world_market_data():
    """Lädt die 20 grössten Unternehmen weltweit (parallel)."""
    return _fetch_parallel(WORLD_TICKERS)

def get_etf_data():
    """Lädt die 20 grössten globalen ETFs / Indexfonds (parallel)."""
    return _fetch_parallel(ETF_TICKERS)

def get_market_news():
    """Lädt News für die wichtigsten Schweizer Titel."""
    all_news = []
    # News nur für die Kernwerte, nicht alle 20 (Performance)
    news_tickers = {
        "Nestlé": "NESN.SW", "Novartis": "NOVN.SW",
        "Roche": "ROG.SW",   "ABB": "ABBN.SW",
        "UBS Group": "UBSG.SW",
    }

    for name, symbol in news_tickers.items():
        try:
            ticker = yf.Ticker(symbol)
            news = ticker.news

            for item in news:
                content = item.get('content', {}) or item
                title = content.get('title')
                if not title:
                    continue

                link_obj = content.get('clickThroughUrl')
                link = link_obj.get('url') if link_obj else content.get('link')

                pub_date_str = content.get('pubDate')
                try:
                    dt = datetime.strptime(pub_date_str, "%Y-%m-%dT%H:%M:%SZ")
                    date_display = dt.strftime('%Y-%m-%d %H:%M')
                    timestamp = dt.timestamp()
                except (ValueError, TypeError):
                    timestamp = content.get('providerPublishTime', 0)
                    date_display = (datetime.fromtimestamp(timestamp).strftime('%Y-%m-%d %H:%M')
                                    if timestamp else "N/A")

                provider = content.get('provider', {})
                publisher = (provider.get('displayName') if isinstance(provider, dict)
                             else content.get('publisher'))

                all_news.append({
                    'title': title,
                    'link': link,
                    'publisher': publisher,
                    'date': date_display,
                    'timestamp': timestamp,
                    'related_ticker': name
                })
        except Exception as e:
            print(f"Fehler beim Laden von News für {name}: {e}")

    all_news.sort(key=lambda x: x['timestamp'], reverse=True)
    return all_news
