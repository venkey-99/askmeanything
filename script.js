// Configuration
const CONFIG = {
    wikipedia: {
        endpoint: 'https://en.wikipedia.org/api/rest_v1/page/summary/'
    },
    openai: {
        endpoint: 'https://api.openai.com/v1/chat/completions',
        apiKey: 'sk-your-openai-api-key-here', // Replace with your actual key
        model: 'gpt-3.5-turbo'
    },
    rateLimit: 2000 // 2 seconds between API calls
};

// DOM Elements
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');
const whGrid = document.getElementById('wh-grid');
// Add with your other variable declarations at the top
const searchHistory = JSON.parse(localStorage.getItem('whSearchHistory')) || [];

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('current-year').textContent = new Date().getFullYear();
    document.addEventListener('DOMContentLoaded', function() {
    // ... all your existing code ...
    
    // Add this at the end
    updateSearchHistoryUI();
});
    
    // Event listeners
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') performSearch();
    });
    searchButton.addEventListener('click', performSearch);
});

async function performSearch() {
    const query = searchInput.value.trim();
    if (!query) return;

    showLoadingState(query);
    
    try {
        // Try Wikipedia first
        const wikiData = await fetchWikipediaData(query);
        
        if (wikiData) {
            displayResults(query, formatWikipediaAnswers(wikiData));
            return;
        }
        
        // Fallback to OpenAI
        const aiAnswers = await fetchOpenAIAnswers(query);
        displayResults(query, aiAnswers);
        
    } catch (error) {
        showError("Failed to get answers. Please try again.");
        console.error("Search error:", error);
    }
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
    const prompt = `Provide concise answers (1-2 sentences) to WH-questions about ${query}. 
    Format as JSON with these exact keys: Who, What, When, Where, Why, Which, Whose, Whom, How.`;
    
    const response = await fetch(CONFIG.openai.endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${CONFIG.openai.apiKey}`
        },
        body: JSON.stringify({
            model: CONFIG.openai.model,
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
        })
    });
    
    if (!response.ok) throw new Error("OpenAI API error");
    const data = await response.json();
    
    try {
        return JSON.parse(data.choices[0].message.content);
    } catch {
        throw new Error("Failed to parse AI response");
    }
}

function formatWikipediaAnswers(data) {
    return {
        "Who": data.extract ? extractPeople(data.extract) : "Various experts and individuals",
        "What": data.description || data.extract?.split('\n')[0] || "Information not available",
        "When": data.timestamp ? `First recorded: ${new Date(data.timestamp).toLocaleDateString()}` : "Timeline varies",
        "Where": data.coordinates ? `Located at ${data.coordinates.lat}, ${data.coordinates.lon}` : "Multiple locations",
        "Why": data.extract ? `Significance: ${data.extract.split('.')[0]}` : "Important for various reasons",
        "Which": data.titles?.canonical || "Various categories",
        "Whose": "Shared responsibility",
        "Whom": "Affects various stakeholders",
        "How": data.extract ? `Process: ${data.extract.split('. ').slice(0, 2).join('. ')}` : "Through complex systems"
    };
}

function extractPeople(text) {
    const names = text.match(/[A-Z][a-z]+ [A-Z][a-z]+/g) || [];
    return names.slice(0, 3).join(', ') || "Various experts";
}

function displayResults(query, answers) {
    whGrid.innerHTML = '';
    
    const questionTypes = ["Who", "What", "When", "Where", "Why", "Which", "Whose", "Whom", "How"];
    
    questionTypes.forEach((type, index) => {
        const block = document.createElement('div');
        block.className = 'wh-block';
        
        block.innerHTML = `
            <div class="wh-content">
                <h3 class="wh-title">${type}</h3>
                <p class="wh-answer">${answers[type] || `No ${type.toLowerCase()} information available`}</p>
            </div>
            <div class="wh-footer">
                <button class="more-btn">More info</button>
                <button class="copy-btn">Copy</button>
            </div>
        `;
        
        whGrid.appendChild(block);
        
        setTimeout(() => {
            block.classList.add('visible');
        }, 100 * index);
    });
    async function performSearch() {
    const query = searchInput.value.trim();
    if (!query) return;

    // Add to history (add these lines)
    if (!searchHistory.includes(query)) {
        searchHistory.unshift(query);
        localStorage.setItem('whSearchHistory', JSON.stringify(searchHistory));
        updateSearchHistoryUI();
    }
    
    // Rest of your existing performSearch code...
}
    function updateSearchHistoryUI() {
    const historyContainer = document.getElementById('search-history');
    historyContainer.innerHTML = `
        <h3>Recent Searches</h3>
        <ul>
            ${searchHistory.slice(0, 5).map(term => `
                <li onclick="document.getElementById('search-input').value='${term}';performSearch()">
                    ${term}
                </li>
            `).join('')}
        </ul>
    `;
}
    // Add event listeners
    document.querySelectorAll('.more-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const answer = this.closest('.wh-block').querySelector('.wh-answer').textContent;
            alert(`Detailed information:\n\n${answer}`);
        });
    });
    
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const answer = this.closest('.wh-block').querySelector('.wh-answer').textContent;
            try {
                await navigator.clipboard.writeText(answer);
                this.textContent = 'Copied!';
                this.classList.add('copied');
                setTimeout(() => {
                    this.textContent = 'Copy';
                    this.classList.remove('copied');
                }, 2000);
            } catch {
                this.textContent = 'Error';
            }
        });
    });
}

function showLoadingState(query) {
    whGrid.innerHTML = '';
    
    // Create 9 skeleton blocks
    for (let i = 0; i < 9; i++) {
        const block = document.createElement('div');
        block.className = 'wh-block visible';
        block.innerHTML = `
            <div class="wh-content">
                <h3 class="wh-title skeleton skeleton-title"></h3>
                <p class="wh-answer skeleton skeleton-block"></p>
                <p class="wh-answer skeleton skeleton-block"></p>
                <p class="wh-answer skeleton skeleton-block" style="width:80%"></p>
            </div>
        `;
        whGrid.appendChild(block);
    }
    
    // Keep the loading message
    const loadingMsg = document.createElement('div');
    loadingMsg.className = 'loading-state';
    loadingMsg.innerHTML = `
        <i class="fas fa-spinner fa-spin"></i>
        <h2>Finding answers about "${query}"</h2>
    `;
    whGrid.appendChild(loadingMsg);
}

function showError(message) {
    whGrid.innerHTML = `
        <div class="error-state">
            <i class="fas fa-exclamation-triangle"></i>
            <h2>${message}</h2>
        </div>
    `;
}
