document.addEventListener('DOMContentLoaded', () => {
    createToastContainer();
    fetchMarketData();
    fetchNews();
    setupNavigation();
    initPortfolio();
    initAlerts();
});

// ── Toast Notifications ─────────────────────────────────────────────────────

function createToastContainer() {
    const container = document.createElement('div');
    container.className = 'toast-container';
    container.id = 'toast-container';
    document.body.appendChild(container);
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const iconMap = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="fa-solid ${iconMap[type] || iconMap.info}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('active')));

    setTimeout(() => {
        toast.classList.remove('active');
        setTimeout(() => toast.remove(), 350);
    }, 4000);
}

// ── Trade Modal ─────────────────────────────────────────────────────────────

function showTradeModal(action, symbol, price, currency) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h3>${action === 'buy' ? 'Kaufen' : 'Verkaufen'}: ${symbol}</h3>
                    <button class="modal-close"><i class="fa-solid fa-times"></i></button>
                </div>
                <div class="modal-price-info">
                    <span>Aktueller Preis</span>
                    <strong>${price.toFixed(2)} ${currency}</strong>
                </div>
                <div class="modal-input-group">
                    <label for="trade-qty">Anzahl Aktien</label>
                    <input type="number" id="trade-qty" min="1" value="1" class="modal-input">
                </div>
                <div class="modal-total">
                    <span>Gesamtbetrag</span>
                    <strong id="trade-total">${price.toFixed(2)} ${currency}</strong>
                </div>
                <div class="modal-footer">
                    <button class="btn-modal-cancel">Abbrechen</button>
                    <button class="btn-modal-confirm ${action === 'buy' ? 'btn-confirm-buy' : 'btn-confirm-sell'}">
                        ${action === 'buy' ? '<i class="fa-solid fa-plus"></i> Kaufen' : '<i class="fa-solid fa-minus"></i> Verkaufen'}
                    </button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('active')));

        const qtyInput = overlay.querySelector('#trade-qty');
        const totalEl  = overlay.querySelector('#trade-total');
        qtyInput.focus(); qtyInput.select();

        qtyInput.addEventListener('input', () => {
            const qty = parseInt(qtyInput.value, 10) || 0;
            totalEl.textContent = `${(qty * price).toFixed(2)} ${currency}`;
            qtyInput.classList.remove('input-error');
        });

        function closeModal(value) {
            overlay.classList.remove('active');
            setTimeout(() => overlay.remove(), 300);
            resolve(value);
        }

        overlay.querySelector('.modal-close').addEventListener('click', () => closeModal(null));
        overlay.querySelector('.btn-modal-cancel').addEventListener('click', () => closeModal(null));
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(null); });
        overlay.querySelector('.btn-modal-confirm').addEventListener('click', () => {
            const qty = parseInt(qtyInput.value, 10);
            if (isNaN(qty) || qty <= 0) { qtyInput.classList.add('input-error'); qtyInput.focus(); return; }
            closeModal(qty);
        });
    });
}

// ── Section Transitions ─────────────────────────────────────────────────────

const SECTIONS = {
    market:    () => document.querySelector('.market-grid'),
    news:      () => document.querySelector('.news-section'),
    welcome:   () => document.querySelector('.welcome-section'),
    portfolio: () => document.querySelector('.portfolio-section'),
    settings:  () => document.querySelector('.settings-section'),
};

function showSections(visibleKeys) {
    Object.keys(SECTIONS).forEach(key => {
        const el = SECTIONS[key]();
        if (!el) return;
        const shouldShow = visibleKeys.includes(key);
        const isHidden   = el.style.display === 'none' || el.style.display === '';

        if (shouldShow && isHidden) {
            el.style.display = key === 'market' ? 'grid' : 'block';
            el.classList.remove('section-exit');
            el.classList.add('section-enter');
            el.addEventListener('animationend', () => el.classList.remove('section-enter'), { once: true });
        } else if (!shouldShow && !isHidden) {
            el.classList.add('section-exit');
            el.addEventListener('animationend', () => {
                el.style.display = 'none';
                el.classList.remove('section-exit');
            }, { once: true });
        }
    });
}

// ── Navigation ──────────────────────────────────────────────────────────────

function setupNavigation() {
    const navIds = ['nav-dashboard', 'nav-world', 'nav-portfolio', 'nav-news', 'nav-settings'];

    function setActive(id) {
        navIds.forEach(k => document.getElementById(k)?.classList.toggle('active', k === id));
    }

    const nav = (id) => document.getElementById(id);

    nav('nav-dashboard')?.addEventListener('click', (e) => {
        e.preventDefault();
        setActive('nav-dashboard');
        document.querySelector('.welcome-section h1').textContent = 'Markt Übersicht Schweiz';
        showSections(['welcome', 'market', 'news']);
        fetchMarketData('/api/market');
    });

    nav('nav-world')?.addEventListener('click', (e) => {
        e.preventDefault();
        setActive('nav-world');
        document.querySelector('.welcome-section h1').textContent = 'Markt Übersicht Weltweit';
        showSections(['welcome', 'market']);
        fetchMarketData('/api/market/world');
    });

    nav('nav-portfolio')?.addEventListener('click', (e) => {
        e.preventDefault();
        setActive('nav-portfolio');
        showSections(['portfolio']);
        updatePortfolioView();
    });

    nav('nav-news')?.addEventListener('click', (e) => {
        e.preventDefault();
        setActive('nav-news');
        showSections(['news']);
    });

    nav('nav-settings')?.addEventListener('click', (e) => {
        e.preventDefault();
        setActive('nav-settings');
        showSections(['settings']);
        renderSettingsPage();
    });
}

// ── Market Data ─────────────────────────────────────────────────────────────

// Last known prices: {instrument: currentPrice (number)}
let lastMarketPrices = {};

async function fetchMarketData(url = '/api/market') {
    const container = document.getElementById('market-container');
    container.innerHTML = '<div class="loading-card"><div class="spinner"></div><p>Analysiere Marktdaten…</p></div>';

    try {
        const response = await fetch(url);
        const data = await response.json();
        container.innerHTML = '';

        if (data.results && data.results.length > 0) {
            data.results.forEach((item, index) => {
                // Store latest prices for alert checks
                lastMarketPrices[item.instrument] = parseFloat(item.price);
                container.appendChild(createMarketCard(item, index));
            });
            checkAlerts(); // immediate check after fresh data
        } else {
            container.innerHTML = '<div class="loading-card">Keine Daten verfügbar / API Fehler</div>';
        }
    } catch (error) {
        console.error('Fehler beim Laden der Marktdaten:', error);
        container.innerHTML = '<div class="loading-card">Fehler beim Verbinden zum Server</div>';
    }
}

async function fetchNews() {
    const container = document.getElementById('news-container');
    try {
        const response = await fetch('/api/news');
        const data = await response.json();
        container.innerHTML = '';
        if (data.news && data.news.length > 0) {
            data.news.forEach(item => container.appendChild(createNewsItem(item)));
        } else {
            container.innerHTML = '<div class="loading-news">Keine Nachrichten gefunden</div>';
        }
    } catch (error) {
        container.innerHTML = '<div class="loading-news">Fehler beim Laden der Nachrichten</div>';
    }
}

// ── Card Builders ───────────────────────────────────────────────────────────

function createMarketCard(item, index = 0) {
    const div = document.createElement('div');
    div.className = 'market-card';
    div.style.animationDelay = `${index * 80}ms`;

    const isPositive   = parseFloat(item.change_pct) >= 0;
    const trendIcon    = isPositive ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down';
    const confNum      = parseFloat(item.confidence);
    let predBadgeClass = 'trend-neutral';
    if (item.prediction === 'STEIGEND' && confNum > 60) predBadgeClass = 'trend-up';
    if (item.prediction === 'FALLEND'  && confNum > 60) predBadgeClass = 'trend-down';

    div.innerHTML = `
        <div class="card-header">
            <div>
                <div class="ticker-name">${item.instrument}</div>
                <div class="ticker-symbol">${item.currency || 'CHF'}</div>
            </div>
            <div class="trend-badge ${predBadgeClass}">${item.signal}</div>
        </div>
        <div class="price-container">
            <div class="current-price">${item.price}</div>
            <div class="price-change" style="color: ${isPositive ? '#10b981' : '#ef4444'}">
                <i class="fa-solid ${trendIcon}"></i> ${item.change_pct}%
            </div>
        </div>
        <div class="prediction-box">
            <div class="prediction-item">
                <span class="pred-label">KI-Trend</span>
                <span class="pred-value">${item.prediction}</span>
            </div>
            <div class="prediction-item">
                <span class="pred-label">Sicherheit</span>
                <span class="pred-value">${item.confidence}</span>
            </div>
            <div class="prediction-item">
                <span class="pred-label">Genauigkeit</span>
                <span class="pred-value">${item.accuracy}</span>
            </div>
        </div>
        <div class="trade-actions">
            <button class="btn-trade btn-buy"><i class="fa-solid fa-plus"></i> Kaufen</button>
            <button class="btn-trade btn-sell"><i class="fa-solid fa-minus"></i> Verkaufen</button>
        </div>`;

    div.querySelector('.btn-buy').addEventListener('click',  () => handleTrade('buy',  item.instrument, parseFloat(item.price), item.currency || 'CHF'));
    div.querySelector('.btn-sell').addEventListener('click', () => handleTrade('sell', item.instrument, parseFloat(item.price), item.currency || 'CHF'));
    return div;
}

function createNewsItem(item) {
    const div = document.createElement('div');
    div.className = 'news-card';
    div.innerHTML = `
        <div class="news-meta">
            <span>${item.publisher || '–'}</span>
            <span>${item.date}</span>
        </div>
        <div class="news-title">${item.title}</div>
        <div class="news-meta" style="margin-bottom: 10px;">
            <span>Ticker: ${item.related_ticker}</span>
        </div>
        <a href="${item.link}" target="_blank" rel="noopener" class="news-link">
            Lesen <i class="fa-solid fa-external-link-alt"></i>
        </a>`;
    return div;
}

// ── Portfolio ───────────────────────────────────────────────────────────────

let portfolio = { balance: 10000.00, holdings: {}, history: [] };

function initPortfolio() {
    const saved = localStorage.getItem('swissAI_portfolio');
    if (saved) {
        const parsed = JSON.parse(saved);
        // migrate old saves that lack history
        portfolio = { history: [], ...parsed };
    } else {
        savePortfolio();
    }
}

function savePortfolio() {
    localStorage.setItem('swissAI_portfolio', JSON.stringify(portfolio));
}

function recordTransaction(type, symbol, qty, price, currency, pnl) {
    portfolio.history.unshift({
        type,       // 'buy' | 'sell'
        symbol,
        qty,
        price,      // price per share at execution
        currency,
        total: qty * price,
        pnl: pnl ?? null,   // only relevant for sells
        date: new Date().toISOString()
    });
}

async function handleTrade(action, symbol, price, currency) {
    const qty = await showTradeModal(action, symbol, price, currency);
    if (!qty) return;
    const totalCost = qty * price;

    if (action === 'buy') {
        if (portfolio.balance < totalCost) {
            showToast(`Nicht genug Guthaben. Dir fehlen ${(totalCost - portfolio.balance).toFixed(2)} ${currency}.`, 'error');
            return;
        }
        portfolio.balance -= totalCost;
        if (!portfolio.holdings[symbol]) portfolio.holdings[symbol] = { quantity: 0, avgPrice: 0, currency };
        const oldTotal = portfolio.holdings[symbol].quantity * portfolio.holdings[symbol].avgPrice;
        portfolio.holdings[symbol].quantity += qty;
        portfolio.holdings[symbol].avgPrice  = (oldTotal + totalCost) / portfolio.holdings[symbol].quantity;
        recordTransaction('buy', symbol, qty, price, currency, null);
        showToast(`${qty} Aktien von ${symbol} erfolgreich gekauft.`, 'success');

    } else {
        if (!portfolio.holdings[symbol] || portfolio.holdings[symbol].quantity < qty) {
            showToast(`Du besitzt nicht genügend Aktien von ${symbol}.`, 'error');
            return;
        }
        const pnl = (price - portfolio.holdings[symbol].avgPrice) * qty;
        portfolio.balance += totalCost;
        portfolio.holdings[symbol].quantity -= qty;
        if (portfolio.holdings[symbol].quantity === 0) delete portfolio.holdings[symbol];
        recordTransaction('sell', symbol, qty, price, currency, pnl);
        showToast(`${qty} Aktien von ${symbol} erfolgreich verkauft.`, 'success');
    }

    savePortfolio();
    updatePortfolioView();
}

function updatePortfolioView() {
    // Balance
    const cashEl = document.getElementById('portfolio-cash');
    if (cashEl) cashEl.textContent = portfolio.balance.toFixed(2) + ' CHF';

    // Holdings grid
    const container = document.getElementById('portfolio-container');
    if (!container) return;
    container.innerHTML = '';

    let holdingsValue = 0;
    const holdingKeys = Object.keys(portfolio.holdings);

    if (holdingKeys.length === 0) {
        container.innerHTML = '<div class="empty-portfolio">Du hast noch keine Aktien gekauft.</div>';
    } else {
        holdingKeys.forEach((symbol, index) => {
            const holding      = portfolio.holdings[symbol];
            const currentPrice = lastMarketPrices[symbol] ?? holding.avgPrice;
            const value        = holding.quantity * currentPrice;
            const pnl          = (currentPrice - holding.avgPrice) * holding.quantity;
            const pnlPct       = ((currentPrice - holding.avgPrice) / holding.avgPrice) * 100;
            holdingsValue     += value;

            const pnlClass  = pnl > 0 ? 'pnl-positive' : pnl < 0 ? 'pnl-negative' : 'pnl-neutral';
            const pnlPrefix = pnl > 0 ? '+' : '';
            const priceNote = lastMarketPrices[symbol]
                ? `Aktueller Kurs: ${currentPrice.toFixed(2)} ${holding.currency}`
                : `Ø Kaufpreis: ${holding.avgPrice.toFixed(2)} ${holding.currency}`;

            const card = document.createElement('div');
            card.className = 'market-card';
            card.style.animationDelay = `${index * 80}ms`;
            card.innerHTML = `
                <div class="card-header">
                    <div>
                        <div class="ticker-name">${symbol}</div>
                        <div class="ticker-symbol">${holding.quantity} Stück</div>
                    </div>
                </div>
                <div class="price-container">
                    <div class="current-price">
                        ${value.toFixed(2)}
                        <span style="font-size:1rem;color:#94a3b8;">${holding.currency}</span>
                    </div>
                    <div style="font-size:0.85rem;color:#94a3b8;margin-top:4px;">${priceNote}</div>
                </div>
                <div class="portfolio-card-meta">
                    <span class="portfolio-pnl ${pnlClass}">
                        ${pnlPrefix}${pnl.toFixed(2)} ${holding.currency}
                        (${pnlPrefix}${pnlPct.toFixed(2)}%)
                    </span>
                </div>
                <div class="trade-actions">
                    <button class="btn-trade btn-sell">
                        <i class="fa-solid fa-minus"></i> Verkaufen
                    </button>
                </div>`;

            card.querySelector('.btn-sell').addEventListener('click', () =>
                handleTrade('sell', symbol, currentPrice, holding.currency)
            );
            container.appendChild(card);
        });
    }

    const valueEl = document.getElementById('portfolio-value');
    if (valueEl) valueEl.textContent = holdingsValue.toFixed(2) + ' CHF';
    const totalEl = document.getElementById('portfolio-total');
    if (totalEl) totalEl.textContent = (portfolio.balance + holdingsValue).toFixed(2) + ' CHF';

    renderHistory();
}

function renderHistory() {
    const tbody    = document.getElementById('history-body');
    const clearBtn = document.getElementById('clear-history-btn');
    if (!tbody) return;

    if (portfolio.history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="history-empty">Noch keine Transaktionen.</td></tr>';
        if (clearBtn) clearBtn.style.display = 'none';
        return;
    }

    if (clearBtn) {
        clearBtn.style.display = 'flex';
        clearBtn.onclick = () => {
            if (confirm('Transaktionsverlauf wirklich löschen?')) {
                portfolio.history = [];
                savePortfolio();
                renderHistory();
            }
        };
    }

    tbody.innerHTML = '';
    portfolio.history.forEach(tx => {
        const date  = new Date(tx.date);
        const dateStr = date.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const timeStr = date.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });

        const isBuy = tx.type === 'buy';
        const pnlCell = tx.pnl !== null
            ? `<td class="text-right pnl-cell ${tx.pnl > 0 ? 'pnl-positive' : tx.pnl < 0 ? 'pnl-negative' : 'pnl-neutral'}">
                   ${tx.pnl >= 0 ? '+' : ''}${tx.pnl.toFixed(2)} ${tx.currency}
               </td>`
            : `<td class="text-right pnl-neutral" style="color:var(--text-secondary);">–</td>`;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="tx-date">${dateStr}<br><span style="font-size:0.78rem;">${timeStr}</span></td>
            <td>
                <span class="tx-badge ${isBuy ? 'tx-buy' : 'tx-sell'}">
                    <i class="fa-solid ${isBuy ? 'fa-plus' : 'fa-minus'}"></i>
                    ${isBuy ? 'Kauf' : 'Verkauf'}
                </span>
            </td>
            <td class="tx-instrument">${tx.symbol}</td>
            <td class="text-right">${tx.qty}</td>
            <td class="text-right">${tx.price.toFixed(2)} ${tx.currency}</td>
            <td class="text-right">${tx.total.toFixed(2)} ${tx.currency}</td>
            ${pnlCell}`;
        tbody.appendChild(row);
    });
}

// ── Price Alerts ────────────────────────────────────────────────────────────

let priceAlerts = [];       // [{id, instrument, direction, price, triggered, createdAt}]
let alertIntervalId = null;

function initAlerts() {
    const saved = localStorage.getItem('swissAI_alerts');
    priceAlerts = saved ? JSON.parse(saved) : [];

    // Ask for browser notification permission if not yet decided
    if ('Notification' in window && Notification.permission === 'default') {
        // Don't auto-ask — let user click the button in Settings
    }

    startAlertInterval(300); // default: 5 minutes
}

function saveAlerts() {
    localStorage.setItem('swissAI_alerts', JSON.stringify(priceAlerts));
}

function startAlertInterval(seconds) {
    if (alertIntervalId) clearInterval(alertIntervalId);
    alertIntervalId = setInterval(() => fetchMarketData(), seconds * 1000);

    const statusEl = document.getElementById('interval-status');
    if (statusEl) statusEl.textContent = `Nächste Prüfung in ${seconds < 60 ? seconds + 's' : (seconds / 60) + ' Min.'}`;
}

function checkAlerts() {
    if (Object.keys(lastMarketPrices).length === 0) return;
    let changed = false;

    priceAlerts.forEach(alert => {
        if (alert.triggered) return;
        const current   = lastMarketPrices[alert.instrument];
        if (current === undefined) return;
        const threshold = parseFloat(alert.price);
        const fired     = alert.direction === 'above' ? current >= threshold : current <= threshold;

        if (fired) {
            alert.triggered = true;
            changed = true;

            const dirText = alert.direction === 'above' ? 'überschritten' : 'unterschritten';
            const msg = `${alert.instrument} hat ${threshold.toFixed(2)} ${dirText}! Aktuell: ${current.toFixed(2)}`;
            showToast(msg, 'info');

            // Browser notification (if permission granted)
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('SwissAI Kursalarm', { body: msg });
            }
        }
    });

    if (changed) {
        saveAlerts();
        // Re-render if settings page is visible
        if (document.querySelector('.settings-section')?.style.display !== 'none') {
            renderAlertsList();
        }
    }
}

function addAlert(instrument, direction, price) {
    priceAlerts.push({
        id: Date.now(),
        instrument,
        direction,
        price,
        triggered: false,
        createdAt: new Date().toISOString()
    });
    saveAlerts();
}

function deleteAlert(id) {
    priceAlerts = priceAlerts.filter(a => a.id !== id);
    saveAlerts();
    renderAlertsList();
}

// ── Settings Page ───────────────────────────────────────────────────────────

function renderSettingsPage() {
    // Notification permission button
    const notifBtn = document.getElementById('request-notif-btn');
    if (notifBtn && 'Notification' in window) {
        if (Notification.permission === 'default') {
            notifBtn.style.display = 'flex';
            notifBtn.onclick = () => {
                Notification.requestPermission().then(perm => {
                    if (perm === 'granted') {
                        showToast('Browser-Benachrichtigungen aktiviert!', 'success');
                        notifBtn.style.display = 'none';
                    }
                });
            };
        } else if (Notification.permission === 'granted') {
            notifBtn.style.display = 'none';
        } else {
            notifBtn.textContent = 'Benachrichtigungen blockiert (Browser-Einstellungen)';
            notifBtn.style.display = 'flex';
            notifBtn.disabled = true;
        }
    }

    // Add alert form
    const addBtn = document.getElementById('add-alert-btn');
    if (addBtn && !addBtn.dataset.bound) {
        addBtn.dataset.bound = '1';
        addBtn.addEventListener('click', () => {
            const instrument = document.getElementById('alert-instrument').value;
            const direction  = document.getElementById('alert-direction').value;
            const priceVal   = parseFloat(document.getElementById('alert-price').value);

            if (!instrument) { showToast('Bitte ein Instrument wählen.', 'error'); return; }
            if (isNaN(priceVal) || priceVal <= 0) { showToast('Bitte einen gültigen Zielkurs eingeben.', 'error'); return; }

            addAlert(instrument, direction, priceVal);
            document.getElementById('alert-price').value = '';
            renderAlertsList();
            showToast(`Alarm für ${instrument} gesetzt.`, 'success');
        });
    }

    // Interval selector
    const intervalSel = document.getElementById('check-interval');
    if (intervalSel && !intervalSel.dataset.bound) {
        intervalSel.dataset.bound = '1';
        intervalSel.addEventListener('change', () => {
            startAlertInterval(parseInt(intervalSel.value, 10));
            showToast('Prüfintervall aktualisiert.', 'info');
        });
    }

    renderAlertsList();
}

function renderAlertsList() {
    const container = document.getElementById('alerts-list');
    if (!container) return;
    container.innerHTML = '';

    if (priceAlerts.length === 0) {
        container.innerHTML = `
            <div class="empty-alerts">
                <i class="fa-solid fa-bell-slash"></i>
                <span>Noch keine Alarme eingerichtet.</span>
            </div>`;
        return;
    }

    // Show active first, then triggered
    const sorted = [...priceAlerts].sort((a, b) => a.triggered - b.triggered);

    sorted.forEach((alert, index) => {
        const item = document.createElement('div');
        item.className = `alert-item${alert.triggered ? ' alert-triggered' : ''}`;
        item.style.animationDelay = `${index * 60}ms`;

        const iconClass = alert.triggered ? 'icon-triggered' : (alert.direction === 'above' ? 'icon-above' : 'icon-below');
        const iconFA    = alert.triggered ? 'fa-check' : (alert.direction === 'above' ? 'fa-arrow-up' : 'fa-arrow-down');
        const condText  = alert.direction === 'above' ? `Steigt über ${parseFloat(alert.price).toFixed(2)}` : `Fällt unter ${parseFloat(alert.price).toFixed(2)}`;

        item.innerHTML = `
            <div class="alert-icon ${iconClass}">
                <i class="fa-solid ${iconFA}"></i>
            </div>
            <div class="alert-info">
                <div class="alert-instrument">${alert.instrument}</div>
                <div class="alert-condition">${condText}</div>
            </div>
            <span class="alert-status-badge ${alert.triggered ? 'badge-triggered' : 'badge-active'}">
                ${alert.triggered ? 'Ausgelöst' : 'Aktiv'}
            </span>
            <button class="btn-delete-alert" title="Alarm löschen">
                <i class="fa-solid fa-trash-can"></i>
            </button>`;

        item.querySelector('.btn-delete-alert').addEventListener('click', () => deleteAlert(alert.id));
        container.appendChild(item);
    });
}
