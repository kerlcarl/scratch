import yfinance as yf

def test_news():
    ticker = yf.Ticker("NESN.SW")
    news = ticker.news
    
    print(f"Gefundene News: {len(news)}")
    if news:
        print(f"Keys in first item: {news[0].keys()}")
        print(f"First item content: {news[0]}")
    
    for item in news[:3]:
        print(f"- {item.get('title')}")
        print(f"  Link: {item.get('link')}")
        print(f"  Publiziert: {item.get('providerPublishTime')}")

if __name__ == "__main__":
    test_news()
