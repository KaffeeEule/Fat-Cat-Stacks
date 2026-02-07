/**
 * Step 3 & 4: Signal Evaluation & External Confirmation
 */

import { detectTickers } from './ticker-engine.js';

export async function processRedditData(data) {
    console.log("Analyzing Reddit data:", data);
    const tickerStats = {};

    data.forEach(item => {
        // Process Post - Use .body or .body_lowercase
        const bodyContent = item.body || item.body_lowercase || '';
        const postText = (item.title || '') + ' ' + bodyContent;
        const foundTickers = detectTickers(postText);

        foundTickers.forEach(ticker => {
            if (!tickerStats[ticker]) {
                tickerStats[ticker] = {
                    ticker: ticker,
                    mentions: 0,
                    uniqueAuthors: new Set(),
                    totalEngagement: 0,
                    sentimentScore: 0,
                    sources: []
                };
            }

            tickerStats[ticker].mentions += 1;
            tickerStats[ticker].uniqueAuthors.add(item.author_hash);
            tickerStats[ticker].totalEngagement += (item.score || 0) + (item.num_comments || 0);
            tickerStats[ticker].sentimentScore += analyzeSentiment(postText);

            tickerStats[ticker].sources.push({
                subreddit: item.subreddit,
                author: item.author_hash,
                id: item.post_id,
                type: 'post'
            });
        });

        // Process Nested Comments
        if (item.comments) {
            item.comments.forEach(comment => {
                const commentText = comment.body || comment.body_lowercase || '';
                const commentTickers = detectTickers(commentText);

                commentTickers.forEach(ticker => {
                    if (!tickerStats[ticker]) return; // Only track comments for tickers already in main thread? 
                    // Or track new ones too? The spec says "signal evaluation", 
                    // so let's track everything.

                    if (!tickerStats[ticker]) {
                        tickerStats[ticker] = { ticker, mentions: 0, uniqueAuthors: new Set(), totalEngagement: 0, sentimentScore: 0, sources: [] };
                    }

                    tickerStats[ticker].mentions += 1;
                    tickerStats[ticker].uniqueAuthors.add(comment.author_hash);
                    tickerStats[ticker].totalEngagement += comment.score || 0;
                    tickerStats[ticker].sentimentScore += analyzeSentiment(commentText);

                    tickerStats[ticker].sources.push({
                        subreddit: item.subreddit,
                        author: comment.author_hash,
                        id: comment.comment_id,
                        type: 'comment'
                    });
                });
            });
        }
    });

    // Convert uniqueAuthors set to size
    Object.values(tickerStats).forEach(stat => {
        stat.uniqueAuthorsCount = stat.uniqueAuthors.size;
        delete stat.uniqueAuthors;
        stat.averageSentiment = stat.mentions > 0 ? stat.sentimentScore / stat.mentions : 0;
    });

    return Object.values(tickerStats);
}


function analyzeSentiment(text) {
    const positive = ['buy', 'moon', 'rocket', 'bull', 'calls', 'growth', 'strength', 'gpt', 'ai'];
    const negative = ['sell', 'drop', 'bear', 'puts', 'crash', 'risky', 'bubble', 'flat'];

    let score = 0;
    const words = text.toLowerCase().split(/\W+/);

    words.forEach(word => {
        if (positive.includes(word)) score += 1;
        if (negative.includes(word)) score -= 1;
    });

    return score;
}

// Mock Step 4: External Confirmation
export async function fetchMarketData(ticker) {
    // In a real app, this would call a Financial API
    // Using mock data for demonstration
    const mockMarketDB = {
        "NVDA": { price: 700.50, change: 2.5, volume: "Stable", newsStrength: 0.9, liquidity: 1.0 },
        "AAPL": { price: 185.20, change: -0.5, volume: "High", newsStrength: 0.7, liquidity: 1.0 },
        "TSLA": { price: 190.10, change: -3.2, volume: "Volatile", newsStrength: 0.5, liquidity: 1.0 },
        "MSFT": { price: 405.15, change: 1.2, volume: "Stable", newsStrength: 0.8, liquidity: 1.0 },
        "GME": { price: 14.50, change: 15.0, volume: "Spike", newsStrength: 0.2, liquidity: 0.3 },
        "AMC": { price: 4.20, change: 5.0, volume: "Low", newsStrength: 0.1, liquidity: 0.2 }
    };

    return mockMarketDB[ticker] || { price: 0, newsStrength: 0, liquidity: 0 };
}
