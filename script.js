// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyB_AZocz9fEjiDdg7qSdcrVazYgNSHwYUg",
    authDomain: "askmewhexplorer.firebaseapp.com",
    // ... get actual values from your Firebase console
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// API Configuration
const CONFIG = {
    wikipedia: {
        endpoint: 'https://en.wikipedia.org/api/rest_v1/page/summary/'
    },
    openai: {
        endpoint: 'https://api.openai.com/v1/chat/completions',
        apiKey: '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', // REPLACE WITH YOUR KEY
        model: 'gpt-3.5-turbo',
        maxTokens: 500
    },
    rateLimit: 2000 // 2 seconds between API calls
};

// DOM Elements
const elements = {
    searchInput: document.getElementById('search-input'),
    searchButton: document.getElementById('search-button'),
    whGrid: document.getElementById('wh-grid'),
    historyItems: document.getElementById('history-items'),
    clearHistory: document.getElementById('clear-history'),
    currentYear: document.getElementById('current-year')
};

// App State
let searchHistory = [];
let lastSearchTime = 0;

// Initialize App
function init() {
    elements.currentYear.textContent = new Date().getFullYear();
    
    // Event Listeners
    elements.searchButton.addEventListener('click', performSearch);
    elements.searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });
    
    // Load any existing history
    loadLocalHistory();
}

// Search Functionality
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
        // Try Wikipedia first
        const wikiData = await fetchWikipediaData(query);
        
        if (wikiData && wikiData.extract) {
            displayResults(query, formatWikipediaAnswers(wikiData));
            return;
        }
        
        // Fallback to OpenAI
        const aiAnswers = await fetchOpenAIAnswers(query);
        displayResults(query, aiAnswers);
        
    } catch (error) {
        console.error("Search error:", error);
        showError("Failed to get answers. Please try again.");
    }
}

// Wikipedia API
async function fetchWikipediaData(query) {
    try {
        const response = await fetch(`${CONFIG.wikipedia.endpoint}${encodeURIComponent(query)}`);
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.warn("Wikipedia fetch failed:", error);
        return null;
    }
}

// OpenAI API
async function fetchOpenAIAnswers(query) {
    if (!CONFIG.openai.apiKey) {
        throw new Error("OpenAI API key not configured");
    }

    const prompt = `Provide detailed answers about "${query}" in JSON format with these keys: 
    Who, What, When, Where, Why, How. Keep each answer concise (1-2 sentences).`;

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

// Format Wikipedia Answers
function formatWikipediaAnswers(data) {
    return {
        "Who": data.extract ? extractPeople(data.extract) : "Various people involved",
        "What": data.description || data.extract?.split('\n')[0] || "Information not available",
        "When": data.timestamp ? new Date(data.timestamp).toLocaleDateString() : "Various time periods",
        "Where": data.coordinates ? `${data.coordinates.lat}, ${data.coordinates.lon}` : "Multiple locations",
        "Why": data.extract ? `Because ${data.extract.split('.')[0]}` : "Multiple reasons",
        "How": data.extract ? `Process: ${data.extract.split('. ')[0]}` : "Complex process"
    };
}

function extractPeople(text) {
    const names = text.match(/[A-Z][a-z]+ [A-Z][a-z]+/g) || [];
    return names.slice(0, 3).join(', ') || "Various people";
}

// Display Results
function displayResults(query, answers) {
    elements.whGrid.innerHTML = '';
    
    const questionTypes = ["Who", "What", "When", "Where", "Why", "How"];
    
    questionTypes.forEach((type, index) => {
        const block = document.createElement('div');
        block.className = 'wh-block';
        
        block.innerHTML = `
            <div class="wh-content">
                <h3 class="wh-title">${type}</h3>
                <p class="wh-answer">${answers[type] || `No ${type.toLowerCase()} information available`}</p>
            </div>
            <div class="wh-footer">
                <button class="more-btn"><i class="fas fa-info-circle"></i> Details</button>
                <button class="copy-btn"><i class="far fa-copy"></i> Copy</button>
            </div>
        `;
        
        elements.whGrid.appendChild(block);
        
        setTimeout(() => {
            block.classList.add('visible');
        }, 100 * index);
        
        // Add button handlers
        block.querySelector('.more-btn').addEventListener('click', () => {
            alert(`${type}:\n\n${answers[type]}`);
        });
        
        block.querySelector('.copy-btn').addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(`${type}: ${answers[type]}`);
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

// Search History
function updateSearchHistory(query) {
    if (!query) return;
    
    // Remove if already exists
    const existingIndex = searchHistory.indexOf(query);
    if (existingIndex > -1) {
        searchHistory.splice(existingIndex, 1);
    }
    
    // Add to beginning
    searchHistory.unshift(query);
    
    // Limit to 10 items
    if (searchHistory.length > 10) {
        searchHistory.pop();
    }
    
    saveHistory();
    updateSearchHistoryUI();
}

function updateSearchHistoryUI() {
    if (searchHistory.length === 0) {
        elements.historyItems.innerHTML = '<div class="empty-history">No searches yet</div>';
        elements.clearHistory.style.display = 'none';
        return;
    }
    
    elements.clearHistory.style.display = 'flex';
    elements.historyItems.innerHTML = searchHistory.map(term => `
        <div class="history-item" data-term="${term}">
            <span class="history-term">${term}</span>
            <button class="delete-history"><i class="fas fa-times"></i></button>
        </div>
    `).join('');
    
    // Add event listeners
    document.querySelectorAll('.history-term').forEach(el => {
        el.addEventListener('click', () => {
            elements.searchInput.value = el.textContent;
            performSearch();
        });
    });
    
    document.querySelectorAll('.delete-history').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const term = btn.closest('.history-item').dataset.term;
            deleteSearchTerm(term);
        });
    });
}

function deleteSearchTerm(term) {
    const index = searchHistory.indexOf(term);
    if (index > -1) {
        searchHistory.splice(index, 1);
        saveHistory();
        updateSearchHistoryUI();
    }
}

function saveHistory() {
    localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
}

function loadLocalHistory() {
    searchHistory = JSON.parse(localStorage.getItem('searchHistory')) || [];
    updateSearchHistoryUI();
}

// UI States
function showLoadingState(query) {
    elements.whGrid.innerHTML = `
        <div class="loading-state">
            <i class="fas fa-spinner fa-spin"></i>
            <h2>Finding answers about "${query}"</h2>
        </div>
    `;
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

// Initialize the app
document.addEventListener('DOMContentLoaded', init);

// Make performSearch available globally
window.performSearch = performSearch;
