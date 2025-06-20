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
            <img src="${user.photoURL}" class="user-avatar-img" alt="Profile" style="width:32px;height:32px;border-radius:50%;">
        `;
    } else {
        elements.authBtnContent.innerHTML = `
            <div class="avatar-placeholder" style="width:32px;height:32px;border-radius:50%;background-color:${stringToColor(user.email)};color:white;display:flex;align-items:center;justify-content:center;">
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

    updateSearchHistory(query);
    showLoadingState(query);

    try {
        // Your existing search implementation
        // ...
    } catch (error) {
        console.error("Search error:", error);
        showError("Failed to get answers. Please try again.");
    }
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