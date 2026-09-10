import { updateStockCache } from "./data.js";

const stocks = await updateStockCache();

const tickers = stocks.map(stock => stock.ticker);