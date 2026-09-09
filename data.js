import YahooFinance from "yahoo-finance2";
import fs from "fs";
import path from "path";

const yahooFinance = new YahooFinance();

// Helper utility to pause execution between API calls
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));


// Parse CSV into an object map: { TICKER: SECTOR }
async function getSP500SectorMap() {
    try {
        const filePath = path.join(process.cwd(), "constituents.csv");
        const text = fs.readFileSync(filePath, "utf-8");

        const lines = text.split("\n").slice(1);
        const sectorMap = {};

        lines.forEach(line => {
            if (!line.trim()) return;

            const columns = line.split(
                /,(?=(?:(?:[^"]*"){2})*[^"]*$)/
            );

            if (!columns || columns.length < 3) return;

            const ticker = columns[0]
                .replace(/"/g, "")
                .trim();

            const sector = columns[2]
                .replace(/"/g, "")
                .trim();

            // Exclude GOOG so Alphabet is represented by GOOGL only
            if (ticker && ticker !== "GOOG") {
                sectorMap[ticker] = sector;
            }
        });

        return sectorMap;

    } catch (error) {
        console.error(
            "Failed to read constituents.csv:",
            error
        );

        return {};
    }
}


// Fetch the S&P 500 and update the cache
async function updateStockCache() {
    if (isFetching) {
        return cachedStocksData;
    }

    isFetching = true;

    console.log("🔄 Starting full S&P 500 update batch...");

    try {
        const sectorMap = await getSP500SectorMap();
        const allTickers = Object.keys(sectorMap);

        if (allTickers.length === 0) {
            throw new Error("No tickers parsed from CSV");
        }

        const BATCH_SIZE = 20;
        const DELAY_MS = 350;

        let combinedQuotes = [];

        for (let i = 0; i < allTickers.length; i += BATCH_SIZE) {

            const batch = allTickers.slice(
                i,
                i + BATCH_SIZE
            );

            try {
                const quotes = await yahooFinance.quote(batch);

                const quotesArray =
                    Array.isArray(quotes)
                        ? quotes
                        : [quotes];

                combinedQuotes =
                    combinedQuotes.concat(quotesArray);

            } catch (apiError) {
                console.error(
                    `⚠️ Failed fetching batch starting at index ${i}:`,
                    apiError.message
                );
            }

            // Throttle requests
            await sleep(DELAY_MS);
        }


        // Convert Yahoo Finance data into the structure
        // your frontend expects
        cachedStocksData = combinedQuotes
            .filter(q => q && q.symbol)
            .map(q => {

                const price = q.regularMarketPrice;
                const previousClose =
                    q.regularMarketPreviousClose;

                return {
                    ticker: q.symbol,

                    name:
                        q.shortName ||
                        q.longName ||
                        "",

                    sector:
                        sectorMap[q.symbol] ||
                        "Unknown",

                    marketCap:
                        q.marketCap || 0,

                    changePercent:
                        previousClose
                            ? ((price - previousClose) /
                               previousClose) * 100
                            : 0
                };
            });


        // Save a static copy for GitHub Pages
        const outputPath = path.join(
            process.cwd(),
            "stocks.json"
        );

        fs.writeFileSync(
            outputPath,
            JSON.stringify(cachedStocksData)
        );


        lastFetchTime = Date.now();

        console.log(
            `✅ Successfully cached ${cachedStocksData.length} stocks.`
        );

        console.log(
            `💾 Saved stock data to ${outputPath}`
        );

        return cachedStocksData;

    } catch (error) {

        console.error(
            "🚨 Cache refresh sequence failed completely:",
            error
        );

        return cachedStocksData || [];

    } finally {
        isFetching = false;
    }
}


// Get cached data, refreshing when necessary
async function getStocks() {

    const isCacheExpired =
        Date.now() - lastFetchTime >
        CACHE_DURATION;


    // Nothing cached yet
    if (!cachedStocksData) {
        await updateStockCache();

    // Cache expired → refresh in background
    } else if (isCacheExpired && !isFetching) {
        updateStockCache();
    }

    return cachedStocksData || [];
}


// ---------------------------------------------------------
// NEWS
// ---------------------------------------------------------



async function updateNewsCache(tickers) {
    const newsData = {};

    for (const ticker of tickers) {
        try {
            console.log(`📰 Fetching news for ${ticker}...`);

            const result = await yahooFinance.search(
                ticker,
                {
                    newsCount: 6,
                    quotesCount: 0
                }
            );

            newsData[ticker] = (result.news || []).map(item => ({
                title: item.title,
                publisher: item.publisher,
                link: item.link,
                publishedAt: item.providerPublishTime,
                thumbnail:
                    item.thumbnail?.resolutions?.[0]?.url || null
            }));

        } catch (error) {
            console.error(
                `⚠️ Failed fetching news for ${ticker}:`,
                error.message
            );

            newsData[ticker] = [];
        }

        // Small delay between requests
        await sleep(350);
    }

    fs.writeFileSync(
        path.join(process.cwd(), "news.json"),
        JSON.stringify(newsData)
    );

    console.log(`✅ Saved news for ${Object.keys(newsData).length} stocks.`);

    return newsData;
}


// Export everything the rest of the application needs
export {
    updateStockCache,
    updateNewsCache
};

