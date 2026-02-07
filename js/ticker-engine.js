/**
 * Step 2: Ticker Detection & Validation
 */

const VALID_TICKERS = ["AAPL", "TSLA", "NVDA", "MSFT", "GME", "AMC", "GOOGL", "AMZN", "META", "NFLX", "AMD", "PLTR", "SOFI", "COIN", "MARA", "RIOT", "BABA", "NIO", "BTC", "ETH"];

export function detectTickers(text) {
    // Matches $TICKER or uppercase strings of 2-5 characters
    const regex = /\$([A-Z]{1,5})|(?:\b)([A-Z]{2,5})(?:\b)/g;
    const matches = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
        // match[1] is the $TICKER group, match[2] is the standalone uppercase group
        const ticker = match[1] || match[2];
        if (VALID_TICKERS.includes(ticker)) {
            matches.push(ticker);
        }
    }

    return [...new Set(matches)]; // Return unique tickers found in this text
}

export function validateTicker(ticker) {
    return VALID_TICKERS.includes(ticker.toUpperCase());
}
