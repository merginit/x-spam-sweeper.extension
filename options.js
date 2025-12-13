/**
 * X Spam Sweeper
 * Copyright (C) 2025 Jonas Fröller
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

// DOM Elements
const urlPatternsList = document.getElementById('urlPatternsList');
const keywordWeightsList = document.getElementById('keywordWeightsList');
const newUrlPatternInput = document.getElementById('newUrlPattern');
const addUrlPatternBtn = document.getElementById('addUrlPatternBtn');
const newKeywordInput = document.getElementById('newKeyword');
const newKeywordWeightInput = document.getElementById('newKeywordWeight');
const addKeywordBtn = document.getElementById('addKeywordBtn');
const resetBtn = document.getElementById('resetBtn');
const saveStatus = document.getElementById('saveStatus');

// Storage keys
const STORAGE_KEY_URL_PATTERNS = 'customUrlPatterns';
const STORAGE_KEY_KEYWORDS = 'customKeywords';

// Current custom settings
let customUrlPatterns = [];
let customKeywords = {};

/**
 * Load settings from storage
 */
async function loadSettings() {
    try {
        const result = await chrome.storage.sync.get([STORAGE_KEY_URL_PATTERNS, STORAGE_KEY_KEYWORDS]);
        customUrlPatterns = result[STORAGE_KEY_URL_PATTERNS] || [];
        customKeywords = result[STORAGE_KEY_KEYWORDS] || {};
        renderAll();
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
}

/**
 * Save settings to storage
 */
async function saveSettings() {
    try {
        await chrome.storage.sync.set({
            [STORAGE_KEY_URL_PATTERNS]: customUrlPatterns,
            [STORAGE_KEY_KEYWORDS]: customKeywords
        });
        showSaveStatus('Saved!');
    } catch (error) {
        console.error('Failed to save settings:', error);
        showSaveStatus('Error saving', true);
    }
}

/**
 * Show save status message
 */
function showSaveStatus(message, isError = false) {
    saveStatus.textContent = message;
    saveStatus.style.color = isError ? 'var(--danger)' : 'var(--success)';
    setTimeout(() => {
        saveStatus.textContent = '';
    }, 2000);
}

/**
 * Render all lists
 */
function renderAll() {
    renderUrlPatterns();
    renderKeywords();
}

/**
 * Render URL patterns list
 */
function renderUrlPatterns() {
    urlPatternsList.innerHTML = '';

    if (customUrlPatterns.length === 0) {
        urlPatternsList.innerHTML = '<div class="empty-state">No custom URL patterns added</div>';
        return;
    }

    customUrlPatterns.forEach((pattern, index) => {
        const item = document.createElement('div');
        item.className = 'pattern-item';
        item.innerHTML = `
            <span class="pattern-text">${escapeHtml(pattern)}</span>
            <button class="remove-btn" data-index="${index}" title="Remove">
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
            </button>
        `;
        urlPatternsList.appendChild(item);
    });

    // Add remove handlers
    urlPatternsList.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            customUrlPatterns.splice(index, 1);
            saveSettings();
            renderUrlPatterns();
        });
    });
}

/**
 * Render keywords list
 */
function renderKeywords() {
    keywordWeightsList.innerHTML = '';

    const keywords = Object.entries(customKeywords);
    if (keywords.length === 0) {
        keywordWeightsList.innerHTML = '<div class="empty-state">No custom keywords added</div>';
        return;
    }

    keywords.forEach(([keyword, weight]) => {
        const item = document.createElement('div');
        item.className = 'keyword-item';
        item.innerHTML = `
            <span class="keyword-text">${escapeHtml(keyword)}</span>
            <span class="keyword-weight">${weight}</span>
            <button class="remove-btn" data-keyword="${escapeHtml(keyword)}" title="Remove">
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
            </button>
        `;
        keywordWeightsList.appendChild(item);
    });

    // Add remove handlers
    keywordWeightsList.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const keyword = btn.dataset.keyword;
            delete customKeywords[keyword];
            saveSettings();
            renderKeywords();
        });
    });
}

/**
 * Add new URL pattern
 */
function addUrlPattern() {
    const pattern = newUrlPatternInput.value.trim().toLowerCase();

    if (!pattern) return;

    // Basic validation 
    if (customUrlPatterns.includes(pattern)) {
        showSaveStatus('Pattern already exists', true);
        return;
    }

    customUrlPatterns.push(pattern);
    newUrlPatternInput.value = '';
    saveSettings();
    renderUrlPatterns();
}

/**
 * Add new keyword
 */
function addKeyword() {
    const keyword = newKeywordInput.value.trim().toLowerCase();
    const weight = parseInt(newKeywordWeightInput.value) || 3;

    if (!keyword) return;

    if (customKeywords[keyword]) {
        showSaveStatus('Keyword already exists', true);
        return;
    }

    customKeywords[keyword] = Math.min(10, Math.max(1, weight));
    newKeywordInput.value = '';
    newKeywordWeightInput.value = '3';
    saveSettings();
    renderKeywords();
}

/**
 * Reset to defaults
 */
async function resetToDefaults() {
    if (!confirm('Reset all custom patterns and keywords? This cannot be undone.')) {
        return;
    }

    customUrlPatterns = [];
    customKeywords = {};
    await saveSettings();
    renderAll();
    showSaveStatus('Reset complete!');
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Event Listeners
addUrlPatternBtn.addEventListener('click', addUrlPattern);
newUrlPatternInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addUrlPattern();
});

addKeywordBtn.addEventListener('click', addKeyword);
newKeywordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addKeyword();
});

resetBtn.addEventListener('click', resetToDefaults);

// Initialize
document.addEventListener('DOMContentLoaded', loadSettings);
