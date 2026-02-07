/**
 * Step 6 & 7: Ranking & Explanation System
 */

import { calculateTrustScore, getRiskFlags } from './scoring-system.js';
import { fetchMarketData } from './market-validator.js';

export async function generateFinalSignals(processedSignals) {
    const results = [];

    for (const signal of processedSignals) {
        const marketData = await fetchMarketData(signal.ticker);
        const score = calculateTrustScore(signal, marketData);
        const riskFlags = getRiskFlags(signal, marketData);

        results.push({
            ticker: signal.ticker,
            score: score,
            redditMentions: signal.mentions,
            avgSentiment: signal.averageSentiment.toFixed(2),
            price: marketData.price,
            riskFlags: riskFlags,
            explanation: generateExplanation(signal, marketData, score)
        });
    }

    // Step 6: Rank by score
    return results.sort((a, b) => b.score - a.score);
}

function generateExplanation(signal, market, score) {
    let explanation = `This stock was detected on Reddit ${signal.mentions} times with a consensus score of ${score}. `;

    if (market.newsStrength > 0.7) {
        explanation += "Strong external news confirmation supports this trend. ";
    } else if (market.newsStrength < 0.3) {
        explanation += "Warning: Very little external news found to validate Reddit hype. ";
    }

    if (signal.uniqueAuthorsCount > 5) {
        explanation += "Detected high author diversity, suggesting broad community interest.";
    }

    return explanation;
}
