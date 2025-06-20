// Configuration
const CONFIG = {
    wikipedia: {
        endpoint: 'https://en.wikipedia.org/api/rest_v1/page/summary/'
    },
    openai: {
        endpoint: 'https://api.openai.com/v1/chat/completions',
        model: 'gpt-3.5-turbo',
        maxTokens: 150
    },
    rateLimit: 2000 // 2 seconds
};

// DOM Elements
const elements = {
    searchInput: document.getElementById('search-input'),
    searchButton: document.getElementById('search-button'),
    whGrid: document.getElementById('wh-grid'),
    searchHistory: document.getElementById('search-history'),
    currentYear: document.getElementById('current-year')
};

// State
let lastSearchTime = 0;
const searchHistory = JSON.parse(localStorage.getItem('whSearchHistory')) || [];

// Initialize
document.addEventListener('DOMContentLoaded', init);

function init() {
    elements.currentYear.textContent = new Date().getFullYear();
    updateSearchHistoryUI();
    
    // Event Listeners
    elements.searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });
    
    elements.searchButton.addEventListener('click', performSearch);
}

async function performSearch() {
    const query = elements.searchInput.value.trim();
    if (!query) return;

    // Rate limiting
    const now = Date.now();
    if (now - lastSearchTime < CONFIG.rateLimit) {
        showError("Please wait a moment before searching again");
        return;
    }
    lastSearchTime = now;

    // Update history
    updateSearchHistory(query);
    showLoadingState(query);

    try {
        const wikiData = await fetchWikipediaData(query);
        if (wikiData) return displayResults(query, formatWikipediaAnswers(wikiData));
        
        const aiAnswers = await fetchOpenAIAnswers(query);
        displayResults(query, aiAnswers);
    } catch (error) {
        console.error("Search error:", error);
        showError("Failed to get answers. Please try again.");
    }
}

function updateSearchHistory(query) {
    if (!searchHistory.includes(query.toLowerCase())) {
        searchHistory.unshift(query);
        if (searchHistory.length > 5) searchHistory.pop();
        localStorage.setItem('whSearchHistory', JSON.stringify(searchHistory));
        updateSearchHistoryUI();
    }
}

function updateSearchHistoryUI() {
    elements.searchHistory.innerHTML = searchHistory.map(term => `
        <div class="history-item">
            <i class="fas fa-history"></i> ${term}
        </div>
    `).join('');
    
    // Add click handlers
    document.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', () => {
            elements.searchInput.value = item.textContent.trim();
            performSearch();
        });
    });
}

async function fetchWikipediaData(query) {
    try {
        const response = await fetch(`${CONFIG.wikipedia.endpoint}${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error("Wikipedia API error");
        return await response.json();
    } catch (error) {
        console.warn("Wikipedia fetch failed:", error);
        return null;
    }
}

async function fetchOpenAIAnswers(query) {
    if (!CONFIG.openai.apiKey) {
        throw new Error("OpenAI API key not configured");
    }

    const prompt = `Provide concise answers about ${query} in this JSON format: 
    {"Who":"...","What":"...","When":"...","Where":"...","Why":"...","How":"..."}
    Keep answers under 2 sentences each.`;

    try {
        const response = await fetch(CONFIG.openai.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CONFIG.openai.apiKey}`
            },
            body: JSON.stringify({
                model: CONFIG.openai.model,
                messages: [{ role: "user", content: prompt }],
                response_format: { type: "json_object" },
                max_tokens: CONFIG.openai.maxTokens
            })
        });

        if (!response.ok) throw new Error(`API error: ${response.status}`);
        
        const data = await response.json();
        return JSON.parse(data.choices[0].message.content);
    } catch (error) {
        console.error("OpenAI error:", error);
        throw error;
    }
}

function formatWikipediaAnswers(data) {
    return {
        "Who": data.extract ? extractPeople(data.extract) : "Various experts",
        "What": data.description || data.extract?.split('\n')[0] || "Not available",
        "When": data.timestamp ? new Date(data.timestamp).toLocaleDateString() : "Unknown date",
        "Where": data.coordinates ? `${data.coordinates.lat}, ${data.coordinates.lon}` : "Various locations",
        "Why": data.extract ? `Because ${data.extract.split('.')[0]}` : "Multiple reasons",
        "How": data.extract ? `Process: ${data.extract.split('. ')[0]}` : "Complex process"
    };
}

function extractPeople(text) {
    const names = text.match(/[A-Z][a-z]+ [A-Z][a-z]+/g) || [];
    return names.slice(0, 3).join(', ') || "Various people";
}

function displayResults(query, answers) {
    elements.whGrid.innerHTML = '';
    
    Object.entries(answers).forEach(([type, answer], index) => {
        const block = document.createElement('div');
        block.className = 'wh-block';
        block.innerHTML = `
            <div class="wh-content">
                <h3 class="wh-title">${type}</h3>
                <p class="wh-answer">${answer || `No ${type.toLowerCase()} info`}</p>
            </div>
            <div class="wh-footer">
                <button class="more-btn"><i class="fas fa-info-circle"></i> Details</button>
                <button class="copy-btn"><i class="far fa-copy"></i> Copy</button>
            </div>
        `;
        elements.whGrid.appendChild(block);
        
        // Animate in
        setTimeout(() => block.classList.add('visible'), 100 * index);
        
        // Add button handlers
        block.querySelector('.more-btn').addEventListener('click', () => {
            alert(`${type}:\n\n${answer}`);
        });
        
        block.querySelector('.copy-btn').addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(`${type}: ${answer}`);
                const btn = block.querySelector('.copy-btn');
                btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                btn.classList.add('copied');
                setTimeout(() => {
                    btn.innerHTML = '<i class="far fa-copy"></i> Copy';
                    btn.classList.remove('copied');
                }, 2000);
            } catch {
                alert("Failed to copy");
            }
        });
    });
}

function showLoadingState(query) {
    elements.whGrid.innerHTML = '';
    
    // Create skeleton blocks
    for (let i = 0; i < 6; i++) {
        const block = document.createElement('div');
        block.className = 'wh-block visible';
        block.innerHTML = `
            <div class="wh-content">
                <h3 class="wh-title skeleton skeleton-title"></h3>
                <p class="wh-answer skeleton skeleton-block"></p>
                <p class="wh-answer skeleton skeleton-block"></p>
            </div>
        `;
        elements.whGrid.appendChild(block);
    }
    
    // Add loading message
    const loadingMsg = document.createElement('div');
    loadingMsg.className = 'loading-state';
    loadingMsg.innerHTML = `
        <i class="fas fa-spinner fa-spin"></i>
        <h2>Finding answers about "${query}"</h2>
    `;
    elements.whGrid.appendChild(loadingMsg);
}

function showError(message) {
    elements.whGrid.innerHTML = `
        <div class="error-state">
            <i class="fas fa-exclamation-triangle"></i>
            <h2>${message}</h2>
            <button onclick="performSearch()">Try Again</button>
        </div>
    `;
}

// Make performSearch available globally for retry button
window.performSearch = performSearch;