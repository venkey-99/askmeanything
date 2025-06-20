// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyB_AZocz9fEjiDdg7qSdcrVazYgNSHwYUg",
    authDomain: "askmewhexplorer.firebaseapp.com",
    projectId: "askmewhexplorer",
    storageBucket: "askmewhexplorer.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();
const provider = new firebase.auth.GoogleAuthProvider();

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
    // Auth Elements
    authBtn: document.getElementById('auth-btn'),
    authDropdown: document.getElementById('auth-dropdown'),
    authBtnContent: document.getElementById('auth-btn-content'),
    preLogin: document.getElementById('pre-login'),
    signupForm: document.getElementById('signup-form'),
    postLogin: document.getElementById('post-login'),
    googleLogin: document.getElementById('google-login'),
    emailLogin: document.getElementById('email-login'),
    doSignup: document.getElementById('do-signup'),
    signoutBtn: document.getElementById('signout-btn'),
    signupToggle: document.getElementById('signup-toggle'),
    loginToggle: document.getElementById('login-toggle'),
    usernameDisplay: document.getElementById('username-display'),
    userEmail: document.getElementById('user-email'),
    authEmail: document.getElementById('auth-email'),
    authPassword: document.getElementById('auth-password'),
    signupName: document.getElementById('signup-name'),
    signupEmail: document.getElementById('signup-email'),
    signupPassword: document.getElementById('signup-password'),
    
    // Search Elements
    searchInput: document.getElementById('search-input'),
    searchButton: document.getElementById('search-button'),
    whGrid: document.getElementById('wh-grid'),
    historyItems: document.getElementById('history-items'),
    clearHistory: document.getElementById('clear-history'),
    currentYear: document.getElementById('current-year')
};

// App State
let searchHistory = [];
let currentUser = null;
let lastSearchTime = 0;

// Initialize App
function init() {
    elements.currentYear.textContent = new Date().getFullYear();
    setupEventListeners();
    initFirebaseAuth();
}

// Firebase Auth
function initFirebaseAuth() {
    auth.onAuthStateChanged(user => {
        currentUser = user;
        if (user) {
            showUserProfile(user);
            loadUserHistory(user.uid);
        } else {
            showAuthForm();
            loadLocalHistory();
        }
    });
}

// [Previous auth functions remain the same...]

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

    updateSearchHistory(query);
    showLoadingState(query);

    try {
        const wikiData = await fetchWikipediaData(query);
        let results;
        
        if (wikiData) {
            results = formatWikipediaAnswers(wikiData);
            results.source = "Wikipedia";
        } else {
            results = await fetchOpenAIAnswers(query);
            results.source = "OpenAI";
        }
        
        displayResults(query, results);
        await saveSearchToFirebase(query, results);
    } catch (error) {
        console.error("Search error:", error);
        showError("Failed to get answers. Please try again.");
    }
}

async function saveSearchToFirebase(query, results) {
    try {
        await firebase.firestore().collection('searches').add({
            query,
            results,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            userId: currentUser?.uid || 'anonymous',
            source: results.source
        });
    } catch (error) {
        console.error("Error saving to Firebase:", error);
    }
}

// [Previous Wikipedia/OpenAI functions remain the same...]

// Enhanced to provide 3 points for each WH-question
function formatWikipediaAnswers(data) {
    const extract = data.extract || '';
    return {
        "Who": [
            extractPeople(extract) || "Various experts and individuals",
            data.originalimage?.source ? `Image by ${data.originalimage.source}` : "Public domain content",
            extract.match(/[A-Z][a-z]+ (?:and|or) [A-Z][a-z]+/g)?.[0] || "Multiple contributors"
        ],
        "What": [
            data.description || "General information",
            extract.split('\n')[0] || "Key facts",
            extract.split('. ')[1] || "Additional details"
        ],
        "When": [
            data.timestamp ? new Date(data.timestamp).toLocaleDateString() : "Unknown time period",
            extract.match(/(?:in|during) \d{4}/)?.[0] || "Various time periods",
            extract.match(/(?:since|until) \d{4}/)?.[0] || "Ongoing timeline"
        ],
        "Where": [
            data.coordinates ? `${data.coordinates.lat}, ${data.coordinates.lon}` : "Various locations",
            extract.match(/(?:in|at) [A-Z][a-z]+(?:, [A-Z][a-z]+)*/g)?.[0] || "Multiple locations",
            extract.match(/(?:located|situated) in [A-Z][a-z]+/g)?.[0] || "Geographically diverse"
        ],
        "Why": [
            `Primary reason: ${extract.split('.')[0] || "Multiple factors"}`,
            extract.match(/because [^\.]+/)?.[0] || "Historical significance",
            extract.match(/due to [^\.]+/)?.[0] || "Complex causation"
        ],
        "How": [
            `Process overview: ${extract.split('. ')[0]}`,
            extract.match(/by [^\.]+/)?.[0] || "Through various methods",
            extract.match(/using [^\.]+/)?.[0] || "With specialized techniques"
        ]
    };
}

// Display Results with 3 points for each WH-question
function displayResults(query, answers) {
    elements.whGrid.innerHTML = '';
    
    const questionTypes = ["Who", "What", "When", "Where", "Why", "How"];
    
    questionTypes.forEach((type, index) => {
        const block = document.createElement('div');
        block.className = 'wh-block';
        
        const points = Array.isArray(answers[type]) ? answers[type] : [answers[type] || `No ${type.toLowerCase()} information available`];
        
        block.innerHTML = `
            <div class="wh-content">
                <h3 class="wh-title">${type}</h3>
                <ul class="wh-answers">
                    ${points.map(point => `<li>${point}</li>`).join('')}
                </ul>
            </div>
            <div class="wh-footer">
                <button class="more-btn"><i class="fas fa-info-circle"></i> Details</button>
                <button class="copy-btn"><i class="far fa-copy"></i> Copy</button>
            </div>
        `;
        
        elements.whGrid.appendChild(block);
        
        setTimeout(() => block.classList.add('visible'), 100 * index);
        
        // Button handlers
        block.querySelector('.more-btn').addEventListener('click', () => {
            alert(`${type}:\n\n${points.join('\n• ')}`);
        });
        
        block.querySelector('.copy-btn').addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(`${type}:\n• ${points.join('\n• ')}`);
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

// [Rest of the history and UI functions remain the same...]

// Initialize the app
document.addEventListener('DOMContentLoaded', init);

// Make performSearch available globally
window.performSearch = performSearch;
