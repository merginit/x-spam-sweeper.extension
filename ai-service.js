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

// =============================================================================
// AI SERVICE - Chrome Built-in AI (Gemini Nano) Integration
// =============================================================================

/**
 * AI Status enum
 * @type {{UNKNOWN: string, CHECKING: string, AVAILABLE: string, DOWNLOADING: string, UNAVAILABLE: string, ERROR: string}}
 */
// eslint-disable-next-line no-unused-vars
const AI_STATUS = {
    UNKNOWN: 'unknown',
    CHECKING: 'checking',
    AVAILABLE: 'available',
    DOWNLOADING: 'downloading',
    UNAVAILABLE: 'unavailable',
    ERROR: 'error'
};

// Module state
// eslint-disable-next-line no-var
var _aiSession = null;
// eslint-disable-next-line no-var
var _aiStatus = AI_STATUS.UNKNOWN;
// eslint-disable-next-line no-var
var _aiStatusMessage = '';
// eslint-disable-next-line no-var
var _aiEnabled = false;

/**
 * System prompt optimized for X DM spam detection
 * Concise to minimize token usage while being specific
 */
const AI_SYSTEM_PROMPT = `You are a spam detection bot for Twitter/X Direct Messages.
Analyze messages for these spam categories:
- CRYPTO: Investment schemes, trading platforms, guaranteed returns, airdrops
- ROMANCE: Sugar daddy/mommy, lonely hearts, dating scams
- REDIRECT: Requests to move to WhatsApp, Telegram, or other platforms
- PHISHING: Account verification, suspended account warnings, click bait
- ADULT: OnlyFans, adult content promotion

SAFE patterns to ignore:
- Short greetings: "hi", "hello", "hey"
- Casual conversation
- Genuine questions or compliments

Respond ONLY with valid JSON (no markdown):
{"isSpam": boolean, "confidence": 0.0-1.0, "category": "Crypto"|"Romance"|"Redirect"|"Phishing"|"Adult"|"Safe", "reason": "brief explanation"}`;

/**
 * Get the language model API - handles both extension and web contexts
 * Chrome has changed the API location multiple times:
 * - Chrome 128+: global LanguageModel
 * - Older: self.ai.languageModel, window.ai.languageModel, chrome.aiOriginTrial.languageModel
 * @returns {Object|null} The language model API or null if unavailable
 */
function _getLanguageModelAPI() {
    // Try the new global LanguageModel API (Chrome 128+)
    if (typeof LanguageModel !== 'undefined') {
        console.log('XSpamSweeper: Using global LanguageModel API');
        return {
            capabilities: () => LanguageModel.availability().then(status => ({
                available: status === 'available' ? 'readily' :
                    status === 'downloadable' ? 'after-download' : 'no'
            })),
            create: (options) => LanguageModel.create(options)
        };
    }

    // Try Chrome extension API (chrome.aiOriginTrial.languageModel)
    if (typeof chrome !== 'undefined' && chrome.aiOriginTrial?.languageModel) {
        console.log('XSpamSweeper: Using chrome.aiOriginTrial.languageModel API');
        return chrome.aiOriginTrial.languageModel;
    }

    // Try the standard web API (self.ai.languageModel)
    if (typeof self !== 'undefined' && self.ai?.languageModel) {
        console.log('XSpamSweeper: Using self.ai.languageModel API');
        return self.ai.languageModel;
    }

    // Try window.ai for older implementations
    if (typeof window !== 'undefined' && window.ai?.languageModel) {
        console.log('XSpamSweeper: Using window.ai.languageModel API');
        return window.ai.languageModel;
    }

    console.log('XSpamSweeper: No AI API found');
    return null;
}

/**
 * Check AI availability without creating a session
 * @returns {Promise<{status: string, message: string}>}
 */
// eslint-disable-next-line no-unused-vars
async function checkAIAvailability() {
    _aiStatus = AI_STATUS.CHECKING;
    _aiStatusMessage = 'Checking AI availability...';

    try {
        const api = _getLanguageModelAPI();

        if (!api) {
            _aiStatus = AI_STATUS.UNAVAILABLE;
            _aiStatusMessage = 'Chrome AI API not available. Requires Chrome 128+ with flags enabled.';
            return { status: _aiStatus, message: _aiStatusMessage };
        }

        const capabilities = await api.capabilities();

        if (capabilities.available === 'no') {
            _aiStatus = AI_STATUS.UNAVAILABLE;
            _aiStatusMessage = 'AI model not available on this device (insufficient hardware or not downloaded).';
        } else if (capabilities.available === 'after-download') {
            _aiStatus = AI_STATUS.DOWNLOADING;
            _aiStatusMessage = 'AI model needs to be downloaded (~1.5GB). It will download in the background.';
        } else if (capabilities.available === 'readily') {
            _aiStatus = AI_STATUS.AVAILABLE;
            _aiStatusMessage = 'AI model ready';
        } else {
            _aiStatus = AI_STATUS.UNKNOWN;
            _aiStatusMessage = `Unknown availability: ${capabilities.available}`;
        }

    } catch (error) {
        _aiStatus = AI_STATUS.ERROR;
        _aiStatusMessage = `Error checking AI: ${error.message}`;
        console.error('XSpamSweeper: AI availability check failed', error);
    }

    console.log(`XSpamSweeper: AI Status: ${_aiStatus} - ${_aiStatusMessage}`);
    return { status: _aiStatus, message: _aiStatusMessage };
}

/**
 * Get current AI status
 * @returns {{status: string, message: string, enabled: boolean}}
 */
// eslint-disable-next-line no-unused-vars
function getAIStatus() {
    return {
        status: _aiStatus,
        message: _aiStatusMessage,
        enabled: _aiEnabled
    };
}

/**
 * Set AI enabled state from settings
 * @param {boolean} enabled
 */
// eslint-disable-next-line no-unused-vars
function setAIEnabled(enabled) {
    _aiEnabled = enabled;
    console.log(`XSpamSweeper: AI scanning ${enabled ? 'enabled' : 'disabled'}`);
}

/**
 * Initialize AI session (lazy - only when first needed)
 * @returns {Promise<boolean>} True if session created successfully
 */
async function _initAISession() {
    if (_aiSession) {
        return true;
    }

    if (_aiStatus !== AI_STATUS.AVAILABLE && _aiStatus !== AI_STATUS.DOWNLOADING) {
        await checkAIAvailability();
    }

    if (_aiStatus !== AI_STATUS.AVAILABLE && _aiStatus !== AI_STATUS.DOWNLOADING) {
        return false;
    }

    try {
        const api = _getLanguageModelAPI();
        if (!api) {
            return false;
        }

        console.log('XSpamSweeper: Creating AI session...');
        _aiSession = await api.create({
            systemPrompt: AI_SYSTEM_PROMPT
        });

        console.log('XSpamSweeper: AI Model Loaded 🚀');
        _aiStatus = AI_STATUS.AVAILABLE;
        _aiStatusMessage = 'AI model active';
        return true;

    } catch (error) {
        console.error('XSpamSweeper: Failed to create AI session', error);
        _aiStatus = AI_STATUS.ERROR;
        _aiStatusMessage = `Session creation failed: ${error.message}`;
        _aiSession = null;
        return false;
    }
}

/**
 * Analyze text with AI for spam detection
 * @param {string} text - Message text to analyze
 * @returns {Promise<{isSpam: boolean, confidence: number, category: string, reason: string}|null>}
 *          Returns null if AI is unavailable or fails
 */
// eslint-disable-next-line no-unused-vars
async function scanWithAI(text) {
    // Check if AI is enabled
    if (!_aiEnabled) {
        return null;
    }

    // Skip very short messages (greetings, etc.)
    if (!text || text.trim().length < 10) {
        return null;
    }

    // Ensure session is ready
    if (!await _initAISession()) {
        return null;
    }

    try {
        // Limit text length to avoid token limits
        const truncatedText = text.length > 500 ? text.substring(0, 500) + '...' : text;

        const prompt = `Analyze this DM for spam: "${truncatedText}"`;
        console.log('XSpamSweeper: Sending to AI:', prompt.substring(0, 100) + '...');

        const result = await _aiSession.prompt(prompt);
        console.log('XSpamSweeper: AI raw response:', result);

        // Clean up response - remove markdown code blocks if present
        let cleanJson = result.trim();
        cleanJson = cleanJson.replace(/^```json\s*/i, '');
        cleanJson = cleanJson.replace(/^```\s*/i, '');
        cleanJson = cleanJson.replace(/\s*```$/i, '');
        cleanJson = cleanJson.trim();

        const verdict = JSON.parse(cleanJson);

        // Validate response structure
        if (typeof verdict.isSpam !== 'boolean' || typeof verdict.confidence !== 'number') {
            console.warn('XSpamSweeper: AI response missing required fields', verdict);
            return null;
        }

        console.log('XSpamSweeper: AI verdict:', verdict);
        return {
            isSpam: verdict.isSpam,
            confidence: Math.min(1, Math.max(0, verdict.confidence)),
            category: verdict.category || 'Unknown',
            reason: verdict.reason || ''
        };

    } catch (error) {
        console.warn('XSpamSweeper: AI analysis failed', error);

        // If session died, reset it for next attempt
        if (error.message?.includes('session') || error.message?.includes('aborted')) {
            _aiSession = null;
        }

        return null;
    }
}

/**
 * Destroy AI session to free resources
 */
// eslint-disable-next-line no-unused-vars
function destroyAISession() {
    if (_aiSession) {
        try {
            _aiSession.destroy();
        } catch (e) {
            // Ignore errors during cleanup
        }
        _aiSession = null;
        console.log('XSpamSweeper: AI session destroyed');
    }
}

/**
 * Load AI enabled preference from storage
 */
async function _loadAIPreference() {
    try {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            const result = await chrome.storage.sync.get(['aiScanningEnabled']);
            _aiEnabled = result.aiScanningEnabled || false;
            console.log('XSpamSweeper: AI scanning preference loaded:', _aiEnabled);
        }
    } catch (e) {
        console.log('XSpamSweeper: Could not load AI preference', e);
    }
}

_loadAIPreference();
