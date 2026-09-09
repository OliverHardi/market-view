import { updateNewsCache } from "./data.js";
import fs from "fs";
import path from "path";

const filePath = path.join(process.cwd(), "constituents.csv");
const text = fs.readFileSync(filePath, "utf-8");

const lines = text.split("\n").slice(1);

const tickers = [];

for (const line of lines) {
    if (!line.trim()) continue;

    const columns = line.split(
        /,(?=(?:(?:[^"]*"){2})*[^"]*$)/
    );

    if (columns.length < 1) continue;

    const ticker = columns[0]
        .replace(/"/g, "")
        .trim();

    if (ticker && ticker !== "GOOG") {
        tickers.push(ticker);
    }
}

console.log(`📰 Updating news for ${tickers.length} stocks...`);

await updateNewsCache(tickers);

console.log("✅ News update complete.");