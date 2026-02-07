/**
 * Main Application Controller
 */

import { processRedditData } from './market-validator.js';
import { generateFinalSignals } from './output-generator.js';

const elements = {
    refreshBtn: document.getElementById('refresh-btn'),
    signalsBody: document.getElementById('signals-body'),
    statsTotal: document.getElementById('stats-total'),
    statsSignals: document.getElementById('stats-signals'),
    statsTopScore: document.getElementById('stats-top-score'),
    modal: document.getElementById('modal'),
    modalBody: document.getElementById('modal-body'),
    closeModal: document.querySelector('.close-modal'),
    mascotSpeech: document.getElementById('mascot-speech'),
    tickerSearch: document.getElementById('ticker-search'),
    navLinks: document.querySelectorAll('#main-nav li'),
    viewTitle: document.getElementById('view-title'),
    viewDesc: document.getElementById('view-desc'),
    discussionFeed: document.getElementById('discussion-feed'),
    longTermFeed: document.getElementById('longterm-feed')
};

const state = {
    redditPosts: [],
    longTermPosts: [],
    signals: [],
    activeTab: 'dashboard'
};


async function init() {
    elements.refreshBtn.addEventListener('click', runAnalysis);
    elements.closeModal.onclick = () => elements.modal.style.display = 'none';
    window.onclick = (e) => { if (e.target == elements.modal) elements.modal.style.display = 'none'; };

    // Tab Switching
    elements.navLinks.forEach(link => {
        link.addEventListener('click', () => {
            const tab = link.getAttribute('data-tab');
            if (!tab) return;
            state.activeTab = tab;

            elements.navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            document.querySelectorAll('.view-content').forEach(v => v.classList.remove('active'));
            document.getElementById(`${tab}-view`).classList.add('active');

            updateViewHeader(tab);
        });
    });

    // Search Filter
    elements.tickerSearch.addEventListener('input', () => {
        const query = elements.tickerSearch.value.toUpperCase();
        const filtered = state.signals.filter(s => s.ticker.includes(query));
        renderUI(filtered, state.redditPosts.length);
    });

    // Load data from the Python script's output
    runAnalysis();
}

function updateViewHeader(tab) {
    const titles = {
        'dashboard': 'Market Intelligence Dash',
        'discussions': 'High-Engagement Explorer',
        'longterm': 'Long-Term Wealth Strategies'
    };
    const descs = {
        'dashboard': 'Scanned: r/stocks, r/investing, r/wallstreetbets, r/pennystocks',
        'discussions': 'Viral threads (>100 score/comments) from the last 24h',
        'longterm': 'Top strategies from r/financialindependence (Last 1 Week)'
    };

    elements.viewTitle.textContent = titles[tab] || 'Intelligence Dash';
    elements.viewDesc.textContent = descs[tab] || '';
}

async function runAnalysis() {
    elements.refreshBtn.textContent = 'Ingesting Reddit...';
    elements.refreshBtn.disabled = true;

    try {
        const timestamp = Date.now();
        console.log("Starting local ingestion trigger at", timestamp);

        if (elements.mascotSpeech) {
            elements.mascotSpeech.innerText = `"I'm calling the mothership to fetch fresh data! Hang tight... 🐈📡"`;
        }

        // Trigger local ingestion via server.py
        const ingestResponse = await fetch('/api/ingest', { method: 'POST' });
        if (!ingestResponse.ok) {
            const errorData = await ingestResponse.json();
            throw new Error(`Ingestion failed: ${errorData.message || 'Unknown error'}`);
        }

        console.log("Ingestion successful. Now fetching newly generated data...");

        // Fetch Hot Discussions
        const response = await fetch(`data/reddit_ingested.json?t=${timestamp}`);
        if (!response.ok) throw new Error(`Hot data file not found (Status: ${response.status}). Run reddit_ingest.py first.`);

        const hotJSON = await response.json();
        console.log("Raw Hot JSON:", hotJSON);

        const hotData = hotJSON.posts || [];
        const hotTime = hotJSON.ingested_at ? new Date(hotJSON.ingested_at).toLocaleString() : 'Unknown';
        console.log(`Extracted ${hotData.length} posts from Hot dataset.`);

        // Fetch Long Term Invest data
        const ltResponse = await fetch(`data/long_term_ingested.json?t=${timestamp}`);
        if (!ltResponse.ok) console.warn('Long Term data file not found.');
        const ltJSON = ltResponse.ok ? await ltResponse.json() : { posts: [] };
        const longTermData = ltJSON.posts || [];
        console.log(`Extracted ${longTermData.length} posts from Long Term dataset.`);

        state.redditPosts = hotData;
        state.longTermPosts = longTermData;

        // Process for dashboard
        console.log("Processing reddit data for tickers...");
        const processed = await processRedditData(hotData);
        console.log("Ticker stats accumulated:", processed);

        console.log("Generating final signals...");
        state.signals = await generateFinalSignals(processed);
        console.log("Final ranked signals:", state.signals);

        console.log("Triggering UI renders...");
        renderUI(state.signals, hotData.length);
        renderDiscussionFeed();
        renderLongTermFeed();

        // Update Stats
        elements.statsTotal.textContent = hotData.length;
        elements.statsSignals.textContent = state.signals.length;
        const maxScore = Math.max(...state.signals.map(s => s.score || 0), 0);
        elements.statsTopScore.textContent = (maxScore).toFixed(0) + '%';

        // Show specific sync time in header for clarity
        if (elements.viewDesc) {
            elements.viewDesc.textContent = `Scanned ${hotData.length} posts at ${hotTime}`;
        }

        if (hotData.length === 0) {
            console.warn("DASHBOARD DATA WARNING: Hot data array is empty.");
            elements.mascotSpeech.innerText = `"I scanned the data, but didn't find any 'hot' signals! The market is quiet... 🐈💤"`;
        } else {
            elements.mascotSpeech.innerText = `"I've analyzed ${hotData.length} posts. Found ${state.signals.length} high-confidence signals!"`;
        }

    } catch (error) {
        console.error('CRITICAL Analysis Error:', error);

        // Specific guidance for "Failed to fetch" (usually server not running)
        if (error.message.includes('fetch') || error.name === 'TypeError') {
            const isFileProtocol = window.location.protocol === 'file:';
            const msg = isFileProtocol
                ? "You're opening index.html directly! Please use http://localhost:8000 instead. 🐈⚠️"
                : "Cannot reach server.py! Is it running in your terminal? 🐈⚠️";
            elements.mascotSpeech.innerText = `"${msg}"`;
        } else {
            elements.mascotSpeech.innerText = `"Oops! My brain hit a snag: ${error.message}. Check console! 🐈⚠️"`;
        }

    } finally {
        elements.refreshBtn.textContent = 'Scan Reddit Now';
        elements.refreshBtn.disabled = false;
    }
}


function renderLongTermFeed() {
    elements.longTermFeed.innerHTML = '';
    if (!state.longTermPosts || state.longTermPosts.length === 0) {
        elements.longTermFeed.innerHTML = '<div class="empty-state">No long-term strategies found. Try scanning again.</div>';
        return;
    }

    state.longTermPosts.forEach(item => {
        const card = createDiscussionCard(item);
        elements.longTermFeed.appendChild(card);
    });
}

function createDiscussionCard(item) {
    const card = document.createElement('div');
    card.className = 'discussion-card';

    const timestamp = item.created_utc ? new Date(item.created_utc * 1000).toLocaleString() : '';

    card.innerHTML = `
        <div class="discussion-header">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;">
                <h3>${item.title}</h3>
                <a href="${item.url}" target="_blank" class="btn-detail" style="text-decoration: none; white-space: nowrap;">View on Reddit</a>
            </div>
            <div class="discussion-meta">
                <span>r/${item.subreddit}</span>
                <span>Score: <strong>${item.score}</strong></span>
                <span>Comments: <strong>${item.num_comments}</strong></span>
                ${timestamp ? `<span>${timestamp}</span>` : ''}
            </div>
        </div>
        <div class="discussion-body">
            ${item.body ? item.body.substring(0, 500) + (item.body.length > 500 ? '...' : '') : ''}
        </div>
        <div class="comments-section">
            <h4>Top Verified Comments (Score > 30)</h4>
            ${item.comments && item.comments.length > 0 ?
            item.comments.map(c => `
                    <div class="comment-item">
                        <div class="comment-author">${c.author_hash} <span class="comment-score">+${c.score}</span></div>
                        <div class="comment-body">${c.body}</div>
                    </div>
                `).join('') : '<p style="font-size: 0.8rem; opacity: 0.5;">No comments met the score threshold yet.</p>'
        }
        </div>
    `;
    return card;
}

function renderDiscussionFeed() {
    elements.discussionFeed.innerHTML = '';
    if (state.redditPosts.length === 0) {
        elements.discussionFeed.innerHTML = '<div class="empty-state">No high-engagement discussions found.</div>';
        return;
    }

    state.redditPosts.forEach(item => {
        const card = createDiscussionCard(item);
        elements.discussionFeed.appendChild(card);
    });
}

function renderUI(signals, totalScannedCount) {
    elements.statsTotal.textContent = totalScannedCount;
    elements.statsSignals.textContent = signals.length;
    elements.statsTopScore.textContent = signals.length > 0 ? signals[0].score + '%' : '0%';
    elements.signalsBody.innerHTML = '';

    signals.forEach(sig => {
        const row = document.createElement('tr');
        const scoreClass = sig.score >= 70 ? 'score-high' : sig.score >= 40 ? 'score-medium' : 'score-low';

        row.innerHTML = `
            <td><strong>$${sig.ticker}</strong></td>
            <td><span class="trust-score-badge ${scoreClass}">${sig.score}%</span></td>
            <td>$${sig.price}</td>
            <td>${sig.avgSentiment}</td>
            <td>${sig.redditMentions}</td>
            <td>${sig.riskFlags.map(f => `<span class="risk-tag">${f}</span>`).join('')}</td>
            <td><button class="btn-detail" data-ticker="${sig.ticker}">Why?</button></td>
        `;

        row.querySelector('.btn-detail').onclick = () => showDetail(sig);
        elements.signalsBody.appendChild(row);
    });
}

function showDetail(sig) {
    elements.modalBody.innerHTML = `
        <h2 style="color: var(--accent-orange); margin-bottom: 20px;">$${sig.ticker} Analysis</h2>
        <p style="font-size: 1.1rem; line-height: 1.6;">${sig.explanation}</p>
        <div style="margin-top: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div class="stat-card">
                <span class="label">Historical Sentiment</span>
                <span class="value" style="font-size: 1.5rem;">${sig.avgSentiment}</span>
            </div>
            <div class="stat-card">
                <span class="label">Unique Sources</span>
                <span class="value" style="font-size: 1.5rem;">${sig.redditMentions} threads</span>
            </div>
        </div>
    `;
    elements.modal.style.display = 'block';
}

init();

