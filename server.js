import express from "express";
import cors from "cors";

import {
    getStocks,
    getNews,
    updateStockCache
} from "./data.js";

const app = express();

app.use(cors());
app.use(express.static("."));


// Stock endpoint
app.get("/api/stocks", async (req, res) => {
    const stocks = await getStocks();
    res.json(stocks);
});


// News endpoint
app.get("/api/news/:ticker", async (req, res) => {
    const ticker = req.params.ticker.toUpperCase();

    const news = await getNews(ticker);

    res.json(news);
});


// Render provides PORT through environment variable
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

    console.log(`Server running on port ${PORT}`);

    // Warm up stock data
    updateStockCache();
});