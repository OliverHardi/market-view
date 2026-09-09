const canvas = document.getElementById("canvas");
const stockData = new Map();

const popup = document.createElement("div");
popup.id = "stock-popup";
popup.className = "stock-popup";
document.body.appendChild(popup);

const POPUP_WIDTH = 274;
let activeBox = null;

canvas.addEventListener("click", (e) => {
    const box = e.target.closest(".stock");
    if (!box) return;
    e.stopPropagation();

    if (activeBox === box) {
        // clicking the same box again closes it
        hidePopup();
        return;
    }

    showPopup(stockData.get(box), box);
});

// --- Close when clicking anything that isn't a stock box or the popup itself ---
document.addEventListener("click", (e) => {
    if (popup.contains(e.target)) return; // clicks inside popup (e.g. news links) don't close it
    if (e.target.closest(".stock")) return; // handled above
    hidePopup();
});

// Optional: close on Escape too
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hidePopup();
});

const newsCache = new Map(); // ticker -> { data, fetchedAt }
const NEWS_CACHE_MS = 15 * 60 * 1000;

async function getNews(ticker) {
    const cached = newsCache.get(ticker);
    if (cached && Date.now() - cached.fetchedAt < NEWS_CACHE_MS) {
        return cached.data;
    }
    try {
        const res = await fetch(`/api/news/${ticker}`);
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        newsCache.set(ticker, { data, fetchedAt: Date.now() });
        return data;
    } catch (err) {
        console.error(`Failed to fetch news for ${ticker}`, err);
        return { error: true };
    }
}

function showPopup(stock, targetBox) {
    activeBox = targetBox;
    targetBox.classList.add("active");

    renderPopupContent(stock, null); // null = still loading
    positionPopup(targetBox);
    popup.classList.add("visible");

    getNews(stock.ticker).then(news => {
        // guard against a stale response landing after the user clicked elsewhere
        if (activeBox === targetBox) {
            renderPopupContent(stock, news);
            positionPopup(targetBox);
        }
    });
}

function hidePopup() {
    if (activeBox) activeBox.classList.remove("active");
    activeBox = null;
    popup.classList.remove("visible");
}

function positionPopup(targetBox) {
    const rect = targetBox.getBoundingClientRect();
    const gap = 12;
    const onRightHalf = rect.left + rect.width / 2 > window.innerWidth * 0.75;

    const left = onRightHalf
        ? rect.left - gap - POPUP_WIDTH
        : rect.right + gap;

    // Provisional top (centered on the box)
    let top = rect.top + rect.height / 2 - popup.offsetHeight / 2;

    // Clamp within viewport
    const margin = 8;
    top = Math.max(margin, Math.min(top, window.innerHeight - popup.offsetHeight - margin));

    popup.style.left = `${Math.max(margin, Math.min(left, window.innerWidth - POPUP_WIDTH - margin))}px`;
    popup.style.top = `${top}px`;
}

function renderPopupContent(stock, news) {
    const newsHtml = news === null
        ? `<div class="popup-news-loading">Loading news…</div>`
        : news.length
            ? news.map(n => `
                <a class="popup-news-item" href="${n.link}" target="_blank" rel="noopener noreferrer">
                    <div class="popup-news-title">${escapeHtml(n.title)}</div>
                    <div class="popup-news-meta">${escapeHtml(n.publisher || "")}${n.publishedAt ? " · " + timeAgo(n.publishedAt) : ""}</div>
                </a>
            `).join("")
            : `<div class="popup-news-empty">No recent news</div>`;

    popup.innerHTML = `
        <div class="popup-header">
            <span class="popup-ticker">${stock.ticker}</span>
            <span class="popup-change" style="color:${getCol(stock.changePercent)}">
                ${stock.changePercent >= 0 ? "+" : ""}${stock.changePercent.toFixed(4)}%
            </span>
        </div>
        <div class="popup-name">${escapeHtml(stock.name || "")}</div>
        <div class="popup-row"><span>Sector</span><span>${escapeHtml(stock.sector || "-")}</span></div>
        <div class="popup-row"><span>Market Cap</span><span>${formatMarketCap(stock.marketCap)}</span></div>
        ${stock.price !== undefined ? `<div class="popup-row"><span>Price</span><span>$${stock.price.toFixed(2)}</span></div>` : ""}
        <div class="popup-news-section">
            <div class="popup-news-heading">News</div>
            ${newsHtml}
        </div>
    `;
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

function timeAgo(dateStr) {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

function formatMarketCap(cap) {
    if (cap >= 1e12) return (cap / 1e12).toFixed(2) + "T";
    if (cap >= 1e9) return (cap / 1e9).toFixed(2) + "B";
    if (cap >= 1e6) return (cap / 1e6).toFixed(2) + "M";
    return cap.toString();
}

function createBox({
    x,
    y,
    width,
    height,
    color = "red",
    text = "",
    change = 0,
    parent = canvas
}) {
    const box = document.createElement("div");

    box.className = "box";

    box.style.left = `${x}px`;
    box.style.top = `${y}px`;
    box.style.width = `${width}px`;
    box.style.height = `${height}px`;
    box.style.background = color;

    if (text) {
        if(width * height > 3000) {
            box.textContent = text + "\n" + change.toFixed(2)+"%";
            box.style.fontSize = Math.max(10, width / 7) + "px";
        }else{
            box.textContent = text;
            box.style.fontSize = Math.max(1, width / 4) + "px";
        }
    }

    parent.appendChild(box);

    return box;
}

function getCol(t) {
    const range = [-4, 4];
    const numColors = 9;
    const lut = [
        {r: 200, g: 55,  b: 58},
        {r: 180, g: 64,  b: 64},
        {r: 165, g: 73,  b: 78},
        {r: 130, g: 85,  b: 93},
        {r: 90,  g: 95,  b: 112},
        {r: 70,  g: 108, b: 95},
        {r: 50,  g: 120, b: 90},
        {r: 35,  g: 125, b: 80},
        {r: 15,  g: 130, b: 65}
    ];
    // smooth color ramp
    const v = Math.max(range[0], Math.min(range[1], t));
    const lowCol = lut[Math.floor((v - range[0]) / (range[1] - range[0]) * (numColors - 1))];
    const highCol = lut[Math.min(Math.floor((v - range[0]) / (range[1] - range[0]) * (numColors - 1)) + 1, numColors - 1)];
    const r = (v - range[0]) / (range[1] - range[0]) * (numColors - 1) - Math.floor((v - range[0]) / (range[1] - range[0]) * (numColors - 1));
    const color = `rgb(
        ${Math.round((1 - r) * lowCol.r + r * highCol.r)},
        ${Math.round((1 - r) * lowCol.g + r * highCol.g)},
        ${Math.round((1 - r) * lowCol.b + r * highCol.b)})`;
    return color;
}

async function getStocks() {
    const response = await fetch("/api/stocks");
    const stocks = await response.json();

    return stocks;
}

const bounds = {
    width: canvas.clientWidth,
    height: canvas.clientHeight
}

function squarify(items, w, h) {
  const total = items.reduce((s, d) => s + d.marketCap, 0);
  const scale = total ? (w * h) / total : 0;
  let queue = items.map(d => ({ ...d, area: d.marketCap * scale }));
  const rects = [];
  let x = 0, y = 0;

  const worst = (row, side) => {
    const sum = row.reduce((s, d) => s + d.area, 0);
    const max = Math.max(...row.map(d => d.area));
    const min = Math.min(...row.map(d => d.area));
    return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min));
  };

  const layoutRow = (row) => {
    const rowArea = row.reduce((s, d) => s + d.area, 0);
    const horizontal = w >= h;
    const thickness = horizontal ? rowArea / h : rowArea / w;
    let offset = 0;
    for (const d of row) {
      const length = thickness ? d.area / thickness : 0;
      if (horizontal) rects.push({ ...d, x, y: y + offset, w: thickness, h: length });
      else rects.push({ ...d, x: x + offset, y, w: length, h: thickness });
      offset += length;
    }
    if (horizontal) { x += thickness; w -= thickness; }
    else { y += thickness; h -= thickness; }
  };

  while (queue.length) {
    const side = Math.min(w, h);
    let row = [queue[0]], i = 1;
    while (i < queue.length && worst([...row, queue[i]], side) <= worst(row, side)) {
      row.push(queue[i]); i++;
    }
    queue = queue.slice(row.length);
    layoutRow(row);
  }
  return rects;
}

async function init() {
    const stocks = await getStocks();
    console.log(stocks);

    // sort into 11 sectors 

    const sectorMap = new Array(11).fill(null).map(() => ({
        sector: "",
        stocks: [],
        marketCap: 0
    }));
    for (const stock of stocks) {
        // first non-empty sector is the sector of the stock unless it's already in the sectorMap
        let sectorIndex = sectorMap.findIndex(s => s.sector === stock.sector);
        if (sectorIndex === -1) {
            sectorIndex = sectorMap.findIndex(s => s.sector === "");
            sectorMap[sectorIndex].sector = stock.sector;
        }
        sectorMap[sectorIndex].stocks.push(stock);
        sectorMap[sectorIndex].marketCap += stock.marketCap;
    }

    // sort sectors by market cap
    sectorMap.sort((a, b) => b.marketCap - a.marketCap);

    // sort each sector by market cap
    for (const sector of sectorMap) {
        sector.stocks.sort((a, b) => b.marketCap - a.marketCap);
    }
    console.log(sectorMap);

    squarify(sectorMap, bounds.width, bounds.height).forEach(sectorRect => {
        const sectorBox = createBox({
            x: sectorRect.x,
            y: sectorRect.y,
            width: sectorRect.w,
            height: sectorRect.h,
            color: `hsl(${Math.random() * 360}, 70%, 50%)`
        });

        sectorBox.classList.add("sector");

        const label = document.createElement("div");
        label.className = "sector-label";
        label.textContent = sectorRect.sector;
        sectorBox.appendChild(label);

        squarify(sectorRect.stocks, sectorRect.w, sectorRect.h).forEach(stockRect => {
            const stockBox = createBox({
                x: stockRect.x,
                y: stockRect.y,
                width: stockRect.w,
                height: stockRect.h,
                color: getCol(stockRect.changePercent),
                text: stockRect.ticker,
                change: stockRect.changePercent,
                parent: sectorBox
            });
            stockBox.classList.add("stock");
            stockData.set(stockBox, stockRect);
        });
    });

}

init();