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
const newKeywordWeightUp = document.getElementById('newKeywordWeightUp');
const newKeywordWeightDown = document.getElementById('newKeywordWeightDown');
const addKeywordBtn = document.getElementById('addKeywordBtn');
const resetBtn = document.getElementById('resetBtn');
const saveStatus = document.getElementById('saveStatus');
const autoLoadAllToggle = document.getElementById('autoLoadAllToggle');
const aiScanningToggle = document.getElementById('aiScanningToggle');
const aiStatusIndicator = document.getElementById('aiStatusIndicator');

// Storage keys
const STORAGE_KEY_URL_PATTERNS = 'customUrlPatterns';
const STORAGE_KEY_KEYWORDS = 'customKeywords';
const STORAGE_KEY_AUTO_LOAD_ALL = 'autoLoadAllMessages';
const STORAGE_KEY_AI_SCANNING = 'aiScanningEnabled';

// Current custom settings
let customUrlPatterns = [];
let customKeywords = {};

/**
 * Load settings from storage
 */
async function loadSettings() {
    try {
        const result = await chrome.storage.sync.get([STORAGE_KEY_URL_PATTERNS, STORAGE_KEY_KEYWORDS, STORAGE_KEY_AUTO_LOAD_ALL, STORAGE_KEY_AI_SCANNING]);
        customUrlPatterns = result[STORAGE_KEY_URL_PATTERNS] || [];
        customKeywords = result[STORAGE_KEY_KEYWORDS] || {};
        autoLoadAllToggle.checked = result[STORAGE_KEY_AUTO_LOAD_ALL] || false;
        aiScanningToggle.checked = result[STORAGE_KEY_AI_SCANNING] || false;
        renderAll();

        await checkAndDisplayAIStatus();
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
            <span class="pattern-text" data-index="${index}" contenteditable="false" title="Click to edit">${escapeHtml(pattern)}</span>
            <button class="remove-btn" data-index="${index}" title="Remove">
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                </svg>
            </button>
        `;
        urlPatternsList.appendChild(item);
    });

    urlPatternsList.querySelectorAll('.pattern-text').forEach(span => {
        span.addEventListener('click', () => {
            if (span.contentEditable !== 'true') {
                span.contentEditable = 'true';
                span.focus();
            }
        });

        span.addEventListener('blur', () => {
            span.contentEditable = 'false';
            const index = parseInt(span.dataset.index);
            const newValue = span.textContent.trim().toLowerCase();

            if (!newValue) {
                // If empty, restore original value
                span.textContent = customUrlPatterns[index];
                return;
            }

            // Validate as domain or URL
            if (!isValidDomainOrUrl(newValue)) {
                showSaveStatus('Invalid domain/URL format', true);
                span.textContent = customUrlPatterns[index];
                return;
            }

            if (newValue !== customUrlPatterns[index]) {
                // Check for duplicates
                if (customUrlPatterns.includes(newValue)) {
                    showSaveStatus('Pattern already exists', true);
                    span.textContent = customUrlPatterns[index];
                    return;
                }
                customUrlPatterns[index] = newValue;
                saveSettings();
            }
        });

        span.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                span.blur();
            }
            if (e.key === 'Escape') {
                const index = parseInt(span.dataset.index);
                span.textContent = customUrlPatterns[index];
                span.blur();
            }
        });
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
            <span class="keyword-text" data-keyword="${escapeHtml(keyword)}" contenteditable="false" title="Click to edit">${escapeHtml(keyword)}</span>
            <div class="number-input-wrapper">
                <button type="button" class="spin-btn spin-down" data-keyword="${escapeHtml(keyword)}">−</button>
                <input type="number" class="keyword-weight-input" data-keyword="${escapeHtml(keyword)}" min="1" max="10" value="${weight}">
                <button type="button" class="spin-btn spin-up" data-keyword="${escapeHtml(keyword)}">+</button>
            </div>
            <button class="remove-btn" data-keyword="${escapeHtml(keyword)}" title="Remove">
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                </svg>
            </button>
        `;
        keywordWeightsList.appendChild(item);
    });

    keywordWeightsList.querySelectorAll('.keyword-text').forEach(span => {
        span.addEventListener('click', () => {
            if (span.contentEditable !== 'true') {
                span.contentEditable = 'true';
                span.focus();
            }
        });

        span.addEventListener('blur', () => {
            span.contentEditable = 'false';
            const oldKeyword = span.dataset.keyword;
            const newKeyword = span.textContent.trim().toLowerCase();

            if (!newKeyword) {
                // If empty, restore original value
                span.textContent = oldKeyword;
                return;
            }

            if (newKeyword !== oldKeyword) {
                // Check for duplicates
                if (customKeywords[newKeyword]) {
                    showSaveStatus('Keyword already exists', true);
                    span.textContent = oldKeyword;
                    return;
                }
                // Transfer weight to new keyword and delete old
                const weight = customKeywords[oldKeyword];
                delete customKeywords[oldKeyword];
                customKeywords[newKeyword] = weight;
                saveSettings();
                renderKeywords();
            }
        });

        span.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                span.blur();
            }
            if (e.key === 'Escape') {
                span.textContent = span.dataset.keyword;
                span.blur();
            }
        });
    });

    keywordWeightsList.querySelectorAll('.keyword-weight-input').forEach(input => {
        input.addEventListener('change', () => {
            const keyword = input.dataset.keyword;
            const newWeight = Math.min(10, Math.max(1, parseInt(input.value) || 1));
            input.value = newWeight;
            customKeywords[keyword] = newWeight;
            saveSettings();
        });
    });

    keywordWeightsList.querySelectorAll('.spin-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const keyword = btn.dataset.keyword;
            const input = keywordWeightsList.querySelector(`.keyword-weight-input[data-keyword="${keyword}"]`);
            let value = parseInt(input.value) || 1;

            if (btn.classList.contains('spin-up')) {
                value = Math.min(10, value + 1);
            } else {
                value = Math.max(1, value - 1);
            }

            input.value = value;
            customKeywords[keyword] = value;
            saveSettings();
        });
    });

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
 * Validate if input is a valid domain or URL
 */
function isValidDomainOrUrl(input) {
    // Domain pattern: allows subdomains, domain name, and TLD
    const domainPattern = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i;

    // URL pattern: optional protocol, domain, optional path
    const urlPattern = /^(https?:\/\/)?([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(\/[^\s]*)?$/i;

    return domainPattern.test(input) || urlPattern.test(input);
}

/**
 * Add new URL pattern
 */
function addUrlPattern() {
    const pattern = newUrlPatternInput.value.trim().toLowerCase();

    if (!pattern) return;

    // Validate domain or URL format
    if (!isValidDomainOrUrl(pattern)) {
        showSaveStatus('Enter a valid domain (e.g. spam.com) or URL', true);
        return;
    }

    // Check for duplicates
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
    if (!confirm('Reset all settings to defaults? This cannot be undone.')) {
        return;
    }

    console.log('XSpamSweeper: Resetting all settings to defaults...');

    // Reset custom patterns and keywords
    customUrlPatterns = [];
    customKeywords = {};

    // Reset toggles to defaults (all off)
    autoLoadAllToggle.checked = false;
    aiScanningToggle.checked = false;

    // Save all settings
    try {
        const settingsToSave = {
            [STORAGE_KEY_URL_PATTERNS]: [],
            [STORAGE_KEY_KEYWORDS]: {},
            [STORAGE_KEY_AUTO_LOAD_ALL]: false,
            [STORAGE_KEY_AI_SCANNING]: false
        };
        console.log('XSpamSweeper: Saving reset settings:', settingsToSave);

        await chrome.storage.sync.set(settingsToSave);

        // Verify the save worked
        const verify = await chrome.storage.sync.get([STORAGE_KEY_AUTO_LOAD_ALL, STORAGE_KEY_AI_SCANNING]);
        console.log('XSpamSweeper: Verified saved settings:', verify);

        renderAll();
        showSaveStatus('Reset complete!');
    } catch (error) {
        console.error('XSpamSweeper: Failed to reset settings:', error);
        showSaveStatus('Error resetting', true);
    }
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
newUrlPatternInput.addEventListener('input', () => {
    addUrlPatternBtn.disabled = !newUrlPatternInput.value.trim();
});

addKeywordBtn.addEventListener('click', addKeyword);
newKeywordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addKeyword();
});
newKeywordInput.addEventListener('input', () => {
    addKeywordBtn.disabled = !newKeywordInput.value.trim();
});

newKeywordWeightUp.addEventListener('click', () => {
    let value = parseInt(newKeywordWeightInput.value) || 1;
    newKeywordWeightInput.value = Math.min(10, value + 1);
});

newKeywordWeightDown.addEventListener('click', () => {
    let value = parseInt(newKeywordWeightInput.value) || 1;
    newKeywordWeightInput.value = Math.max(1, value - 1);
});

newKeywordWeightInput.addEventListener('blur', () => {
    let value = parseInt(newKeywordWeightInput.value) || 1;
    newKeywordWeightInput.value = Math.min(10, Math.max(1, value));
});

resetBtn.addEventListener('click', resetToDefaults);

autoLoadAllToggle.addEventListener('change', async () => {
    try {
        await chrome.storage.sync.set({
            [STORAGE_KEY_AUTO_LOAD_ALL]: autoLoadAllToggle.checked
        });
        showSaveStatus('Saved!');
    } catch (error) {
        console.error('Failed to save auto-load setting:', error);
        showSaveStatus('Error saving', true);
    }
});

aiScanningToggle.addEventListener('change', async () => {
    try {
        await chrome.storage.sync.set({
            [STORAGE_KEY_AI_SCANNING]: aiScanningToggle.checked
        });
        showSaveStatus('Saved!');
    } catch (error) {
        console.error('Failed to save AI scanning setting:', error);
        showSaveStatus('Error saving', true);
    }
});

/**
 * Check AI availability and update the status indicator
 * Note: Chrome AI API is only available in web page contexts, not in chrome-extension:// URLs
 * So we can't fully check availability here - we just allow enabling and check in content script
 */
async function checkAndDisplayAIStatus() {
    // Update indicator to "Checking" state
    aiStatusIndicator.textContent = 'Checking...';
    aiStatusIndicator.className = 'ai-status checking';

    try {
        // Get the language model API - try multiple entry points
        let api = null;
        let apiSource = '';

        // Try Chrome extension API first (may work in some Chrome versions)
        if (typeof chrome !== 'undefined' && chrome.aiOriginTrial?.languageModel) {
            api = chrome.aiOriginTrial.languageModel;
            apiSource = 'chrome.aiOriginTrial';
        }
        // Try standard web API
        else if (typeof self !== 'undefined' && self.ai?.languageModel) {
            api = self.ai.languageModel;
            apiSource = 'self.ai';
        }
        // Try window.ai for older implementations
        else if (typeof window !== 'undefined' && window.ai?.languageModel) {
            api = window.ai.languageModel;
            apiSource = 'window.ai';
        }

        console.log('XSpamSweeper: AI API check:', { apiSource });

        if (!api) {
            // API not available in extension context - this is expected
            // User can still enable the toggle, actual check happens in content script
            console.log('XSpamSweeper: AI API not available in extension context (expected)');
            aiStatusIndicator.textContent = 'Enable to use on X';
            aiStatusIndicator.className = 'ai-status checking';
            aiScanningToggle.disabled = false; // Allow enabling anyway
            return;
        }

        const capabilities = await api.capabilities();
        console.log('XSpamSweeper: AI capabilities:', capabilities);

        if (capabilities.available === 'readily') {
            aiStatusIndicator.textContent = 'Available ✓';
            aiStatusIndicator.className = 'ai-status available';
            aiScanningToggle.disabled = false;
        } else if (capabilities.available === 'after-download') {
            aiStatusIndicator.textContent = 'Downloading...';
            aiStatusIndicator.className = 'ai-status downloading';
            aiScanningToggle.disabled = false;
        } else {
            console.log('XSpamSweeper: AI not available, status:', capabilities.available);
            aiStatusIndicator.textContent = 'Not Available';
            aiStatusIndicator.className = 'ai-status unavailable';
            aiScanningToggle.disabled = false; // Still allow toggle, check happens on X
        }

    } catch (error) {
        console.error('XSpamSweeper: AI check failed:', error);
        // Don't block the toggle on error - actual check happens in content script
        aiStatusIndicator.textContent = 'Enable to use on X';
        aiStatusIndicator.className = 'ai-status checking';
        aiScanningToggle.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    addUrlPatternBtn.disabled = true;
    addKeywordBtn.disabled = true;
    loadSettings();
});
