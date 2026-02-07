/**
 * Step 5: Composite Scoring Logic
 */

export function calculateTrustScore(signal, marketData) {
    // Formula from Implementation Plan:
    // 30% Reddit Consensus + 30% Fundamental Strength (News) + 20% Analyst/Sentiment + 20% Liquidity

    let score = 0;

    // 1. Reddit Momentum (Mentions & Authors) - Max 30 points
    const momentum = Math.min((signal.mentions * 5) + (signal.uniqueAuthorsCount * 10), 30);
    score += momentum;

    // 2. News/Confirmation Strength - Max 30 points
    const newsContribution = marketData.newsStrength * 30;
    score += newsContribution;

    // 3. Sentiment Quality - Max 20 points
    // Normalize sentiment (-2 to 2) to (0 to 20)
    const sentimentContribution = Math.max(0, Math.min(((signal.averageSentiment + 2) / 4) * 20, 20));
    score += sentimentContribution;

    // 4. Market Liquidity - Max 20 points
    const liquidityContribution = marketData.liquidity * 20;
    score += liquidityContribution;

    // Penalties
    if (marketData.liquidity < 0.5) score -= 20; // High risk penalty
    if (signal.uniqueAuthorsCount < 2) score -= 15; // Low author diversity penalty

    return Math.max(0, Math.min(Math.round(score), 100));
}

export function getRiskFlags(signal, marketData) {
    const flags = [];
    if (marketData.liquidity < 0.4) flags.push("Low Liquidity");
    if (signal.uniqueAuthorsCount < 2) flags.push("Single-User Signal");
    if (marketData.newsStrength < 0.2) flags.push("Unconfirmed Signal");
    if (signal.averageSentiment < -0.5) flags.push("Strong Negativity");
    return flags;
}
