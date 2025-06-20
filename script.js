// Firebase Configuration (Replace with your actual config)
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT",
    storageBucket: "YOUR_PROJECT.appspot.com",
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
        apiKey: 'sk-your-openai-api-key-here', // Replace with your actual key
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
            // User signed in
            showUserProfile(user);
            loadUserHistory(user.uid);
        } else {
            // User signed out
            showAuthForm();
            loadLocalHistory();
        }
    });
}

function showUserProfile(user) {
    // Update avatar button
    if (user.photoURL) {
        elements.authBtnContent.innerHTML = `
            <img src="${user.photoURL}" class="user-avatar-img" alt="Profile">
        `;
    } else {
        elements.authBtnContent.innerHTML = `
            <div class="avatar-placeholder" style="background-color:${stringToColor(user.email)}">
                ${user.email.charAt(0).toUpperCase()}
            </div>
        `;
    }
    
    // Update dropdown
    elements.preLogin.style.display = 'none';
    elements.signupForm.style.display = 'none';
    elements.postLogin.style.display = 'block';
    
    elements.usernameDisplay.textContent = user.displayName || user.email.split('@')[0];
    elements.userEmail.textContent = user.email;
}

function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 70%, 60%)`;
}

function showAuthForm() {
    elements.authBtnContent.innerHTML = `<i class="fas fa-user-circle"></i>`;
    elements.preLogin.style.display = 'block';
    elements.signupForm.style.display = 'none';
    elements.postLogin.style.display = 'none';
    clearAuthForms();
}

function clearAuthForms() {
    elements.authEmail.value = '';
    elements.authPassword.value = '';
    elements.signupName.value = '';
    elements.signupEmail.value = '';
    elements.signupPassword.value = '';
}

// Auth Functions
function signInWithGoogle() {
    auth.signInWithPopup(provider)
        .then(() => {
            elements.authDropdown.classList.remove('show');
        })
        .catch(error => {
            console.error("Google sign-in failed:", error);
            alert(`Google sign-in failed: ${error.message}`);
        });
}

function signInWithEmail() {
    const email = elements.authEmail.value;
    const password = elements.authPassword.value;
    
    if (!email || !password) {
        alert("Please enter both email and password");
        return;
    }
    
    auth.signInWithEmailAndPassword(email, password)
        .then(() => {
            elements.authDropdown.classList.remove('show');
        })
        .catch(error => {
            console.error("Sign in failed:", error);
            alert(`Sign in failed: ${error.message}`);
        });
}

function signUpWithEmail() {
    const name = elements.signupName.value;
    const email = elements.signupEmail.value;
    const password = elements.signupPassword.value;
    
    if (!name || !email || !password) {
        alert("Please fill in all fields");
        return;
    }
    
    if (password.length < 6) {
        alert("Password should be at least 6 characters");
        return;
    }
    
    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Update user profile
            return userCredential.user.updateProfile({
                displayName: name
            });
        })
        .then(() => {
            elements.authDropdown.classList.remove('show');
            // Initialize user history
            return db.collection('userHistory').doc(auth.currentUser.uid).set({
                searches: []
            });
        })
        .catch(error => {
            console.error("Sign up failed:", error);
            alert(`Sign up failed: ${error.message}`);
        });
}

function signOut() {
    auth.signOut()
        .then(() => {
            elements.authDropdown.classList.remove('show');
        })
        .catch(error => {
            console.error("Sign out failed:", error);
        });
}

// History Management
async function loadUserHistory(userId) {
    try {
        const doc = await db.collection('userHistory').doc(userId).get();
        searchHistory = doc.exists ? doc.data().searches || [] : [];
        updateSearchHistoryUI();
    } catch (error) {
        console.error("Error loading history:", error);
        searchHistory = [];
    }
}

function loadLocalHistory() {
    searchHistory = JSON.parse(localStorage.getItem('localHistory')) || [];
    updateSearchHistoryUI();
}

async function saveHistory() {
    try {
        if (currentUser) {
            await db.collection('userHistory').doc(currentUser.uid).set({
                searches: searchHistory.slice(0, 10) // Keep only last 10
            });
        } else {
            localStorage.setItem('localHistory', JSON.stringify(searchHistory.slice(0, 10)));
        }
    } catch (error) {
        console.error("Error saving history:", error);
    }
}

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
            <div class="history-actions">
                <button class="delete-history" aria-label="Delete">
                    <i class="fas fa-times"></i>
                </button>
            </div>
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
        
        // Animate removal
        const item = document.querySelector(`.history-item[data-term="${term}"]`);
        if (item) {
            item.style.transform = 'translateX(100%)';
            item.style.opacity = '0';
            setTimeout(() => updateSearchHistoryUI(), 300);
        }
    }
}

function clearAllHistory() {
    if (searchHistory.length === 0 || !confirm('Clear all search history?')) return;
    
    // Animate all items out
    const items = document.querySelectorAll('.history-item');
    items.forEach((item, i) => {
        item.style.transform = 'translateX(100%)';
        item.style.opacity = '0';
        item.style.transitionDelay = `${i * 50}ms`;
    });
    
    // Clear data
    searchHistory = [];
    if (currentUser) {
        db.collection('userHistory').doc(currentUser.uid).delete();
    } else {
        localStorage.removeItem('localHistory');
    }
    
    setTimeout(() => updateSearchHistoryUI(), 300 + (items.length * 50));
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

    updateSearchHistory(query);
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
        console.error("Search error:", error);
        showError("Failed to get answers. Please try again.");
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
    const prompt = `Provide detailed answers about "${query}" in this JSON format with at least 3 points for each WH-question: 
    {
        "Who": ["point 1", "point 2", "point 3"],
        "What": ["point 1", "point 2", "point 3"],
        "When": ["point 1", "point 2", "point 3"],
        "Where": ["point 1", "point 2", "point 3"],
        "Why": ["point 1", "point 2", "point 3"],
        "How": ["point 1", "point 2", "point 3"]
    }
    Keep each point concise (under 15 words).`;

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
        "Who": data.extract ? extractPeople(data.extract) : "Various experts and individuals",
        "What": data.description || data.extract?.split('\n')[0] || "Information not available",
        "When": data.timestamp ? `First recorded: ${new Date(data.timestamp).toLocaleDateString()}` : "Timeline varies",
        "Where": data.coordinates ? `Located at ${data.coordinates.lat}, ${data.coordinates.lon}` : "Multiple locations",
        "Why": data.extract ? `Significance: ${data.extract.split('.')[0]}` : "Important for various reasons",
        "How": data.extract ? `Process: ${data.extract.split('. ').slice(0, 2).join('. ')}` : "Through complex systems"
    };
}

function extractPeople(text) {
    const names = text.match(/[A-Z][a-z]+ [A-Z][a-z]+/g) || [];
    return names.slice(0, 3).join(', ') || "Various experts";
}

function displayResults(query, answers) {
    elements.whGrid.innerHTML = '';
    
    const questionTypes = ["Who", "What", "When", "Where", "Why", "How"];
    
    questionTypes.forEach((type, index) => {
        const block = document.createElement('div');
        block.className = 'wh-block';
        
        const answerContent = Array.isArray(answers[type]) 
            ? `<ul class="wh-answers">${answers[type].map(point => `<li>${point}</li>`).join('')}</ul>`
            : `<p class="wh-answer">${answers[type] || `No ${type.toLowerCase()} information available`}</p>`;
        
        block.innerHTML = `
            <div class="wh-content">
                <h3 class="wh-title">${type}</h3>
                ${answerContent}
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
        
        // Add event listeners
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

// Event Listeners
function setupEventListeners() {
    // Auth Button
    elements.authBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        elements.authDropdown.classList.toggle('show');
    });
    
    // Auth Actions
    elements.googleLogin.addEventListener('click', signInWithGoogle);
    elements.emailLogin.addEventListener('click', signInWithEmail);
    elements.doSignup.addEventListener('click', signUpWithEmail);
    elements.signoutBtn.addEventListener('click', signOut);
    
    // Form Toggles
    elements.signupToggle.addEventListener('click', () => {
        elements.preLogin.style.display = 'none';
        elements.signupForm.style.display = 'block';
    });
    
    elements.loginToggle.addEventListener('click', () => {
        elements.signupForm.style.display = 'none';
        elements.preLogin.style.display = 'block';
    });
    
    // Search
    elements.searchButton.addEventListener('click', performSearch);
    elements.searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });
    
    // History
    elements.clearHistory.addEventListener('click', clearAllHistory);
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.auth-container')) {
            elements.authDropdown.classList.remove('show');
        }
    });
    
    // Prevent dropdown close when clicking inside
    elements.authDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
    });
}

// Initialize the app
document.addEventListener('DOMContentLoaded', init);

// Make performSearch available globally for retry button
window.performSearch = performSearch;