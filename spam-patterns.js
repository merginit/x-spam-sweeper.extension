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
// CUSTOM PATTERNS FROM OPTIONS PAGE
// =============================================================================

// Custom patterns loaded from chrome.storage.sync
let customUrlPatterns = [];
let customKeywords = {};

/**
 * Initialize custom patterns from storage
 * Call this before first use in content scripts
 */
async function initCustomPatterns() {
    try {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            const result = await chrome.storage.sync.get(['customUrlPatterns', 'customKeywords']);
            customUrlPatterns = result.customUrlPatterns || [];
            customKeywords = result.customKeywords || {};
            console.log('XSpamSweeper: Loaded custom patterns:',
                customUrlPatterns.length, 'URLs,',
                Object.keys(customKeywords).length, 'keywords');
            console.log('XSpamSweeper: Custom keywords:', customKeywords);
        }
    } catch (e) {
        console.log('XSpamSweeper: Could not load custom patterns', e);
    }
}

// Auto-init if in extension context
if (typeof chrome !== 'undefined' && chrome.storage) {
    initCustomPatterns();
}

// =============================================================================
// URL PATTERNS - Domains that indicate spam/scam
// =============================================================================

/**
 * High-risk URL patterns (instant red flag)
 * Off-platform redirects are the primary indicator of spam/scam DMs
 */
const HIGH_RISK_URL_PATTERNS = [
    // Adult content platforms
    /onlyfans\.com/i,
    /fansly\.com/i,
    /fanvue\.com/i,
    /maloum\.com/i,
    /manyvids\.com/i,
    /mym\.fans/i,
    /fancentro\.com/i,
    /admireme\.vip/i,

    // The "Holy Trinity" of DM Spam - Off-platform messaging
    /wa\.me\//i,              // WhatsApp shortlinks
    /chat\.whatsapp\.com/i,   // WhatsApp groups
    /api\.whatsapp\.com/i,    // WhatsApp API links
    /t\.me\//i,               // Telegram
    /telegram\.me/i,          // Telegram alternative
    /telegram\.org/i,

    // Crypto/Investment scam domains (common patterns)
    /binance\-/i,             // Fake Binance domains
    /coinbase\-/i,            // Fake Coinbase domains
    /metamask\-/i,            // Fake MetaMask domains
];

/**
 * Medium-risk URL patterns (suspicious, needs review)
 * Generic shorteners and invite links
 */
const MEDIUM_RISK_URL_PATTERNS = [
    // URL shorteners (often used to hide malicious links)
    /bit\.ly\//i,
    /tinyurl\.com/i,
    /t\.co\//i,               // Twitter's own shortener (still suspicious in DMs)
    /goo\.gl\//i,
    /ow\.ly\//i,
    /is\.gd\//i,
    /buff\.ly\//i,
    /adf\.ly\//i,
    /shorte\.st/i,
    /cutt\.ly/i,

    // Link aggregators (often used by spam/promo accounts)
    /allmylinks\.com/i,
    /getmysocial\.com/i,
    /beacons\.ai/i,
    /solo\.to/i,
    /linktr\.ee/i,

    // Discord invites (often crypto pump schemes)
    /discord\.gg\//i,
    /discord\.com\/invite/i,

    // Suspicious path keywords in any URL
    /\/trading/i,
    /\/crypto/i,
    /\/investment/i,
    /\/airdrop/i,
    /\/giveaway/i,
];

/**
 * Safe domains (whitelist) - Won't trigger spam flags
 */
const SAFE_DOMAINS = [
    'youtube.com',
    'youtu.be',
    'twitter.com',
    'x.com',
    'spotify.com',
    'github.com',
    'linkedin.com',
    'instagram.com',
    'facebook.com',
    'tiktok.com',
    'reddit.com',
    'medium.com',
    'substack.com',
    'twitch.tv',
    'soundcloud.com',
    'bandcamp.com',
    'patreon.com',
    'ko-fi.com',
    'buymeacoffee.com',
];

// =============================================================================
// KEYWORD WEIGHTS - Spam scoring based on text content
// =============================================================================

/**
 * Keyword weights for spam scoring
 * Higher weight = more likely spam
 */
const SPAM_KEYWORD_WEIGHTS = {
    // Crypto/Investment scam keywords (weight: 3-5)
    'crypto': 3,
    'bitcoin': 2,
    'ethereum': 2,
    'trading': 3,
    'investment': 3,
    'invest': 3,
    'profit': 3,
    '100x': 5,
    '1000x': 5,
    'guaranteed': 4,
    'passive income': 4,
    'financial freedom': 3,
    'forex': 4,
    'binary options': 5,
    'nft drop': 3,
    'airdrop': 3,
    'giveaway': 2,
    'free money': 5,
    'double your': 5,

    // Urgency/pressure tactics (weight: 2-4)
    'urgent': 3,
    'act now': 4,
    'limited time': 3,
    'don\'t miss': 2,
    'last chance': 3,
    'hurry': 2,
    'expires': 2,

    // Scam language patterns (weight: 2-4)
    'kindly': 3,           // VERY common in scams
    'dear friend': 4,
    'dear sir': 3,
    'dear madam': 3,
    'congratulations': 2,
    'you have been selected': 5,
    'you have won': 5,
    'claim your': 4,
    'verify your account': 4,
    'suspended': 3,

    // Off-platform redirect keywords (weight: 4-5)
    'whatsapp': 5,
    'telegram': 5,
    'add me on': 4,
    'message me on': 4,
    'contact me on': 3,
    'text me': 3,
    'dm me on': 3,

    // Romance scam indicators (weight: 2-3)
    'lonely': 2,
    'looking for love': 3,
    'sugar daddy': 4,
    'sugar mommy': 4,
    'sugar baby': 3,
    'allowance': 2,
    'spoil you': 3,

    // Adult content promotion (weight: 3-4)
    'onlyfans': 4,
    'fansly': 4,
    'link in bio': 2,
    'check my profile': 2,
    'exclusive content': 3,
    'subscribe': 2,
};

// =============================================================================
// SPAM DETECTION FUNCTIONS
// =============================================================================

/**
 * Risk levels for spam classification
 */
const RISK_LEVELS = {
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low',
    SAFE: 'safe'
};

/**
 * Check if a URL is in the safe domain whitelist
 * @param {string} url - URL to check
 * @returns {boolean}
 */
function isUrlSafe(url) {
    if (!url) return false;
    const lowerUrl = url.toLowerCase();
    return SAFE_DOMAINS.some(domain => lowerUrl.includes(domain));
}

/**
 * Check text against URL patterns
 * @param {string} text - Text to analyze
 * @returns {{isSpam: boolean, riskLevel: string, matchedPatterns: string[]}}
 */
function checkUrlPatterns(text) {
    if (!text) return { isSpam: false, riskLevel: RISK_LEVELS.SAFE, matchedPatterns: [] };

    const lowerText = text.toLowerCase();
    const matchedPatterns = [];

    // Check for safe domains first - if found, reduce suspicion
    const hasSafeUrl = SAFE_DOMAINS.some(domain => lowerText.includes(domain));

    // Check high-risk patterns
    for (const pattern of HIGH_RISK_URL_PATTERNS) {
        if (pattern.test(text)) {
            matchedPatterns.push(pattern.toString());
        }
    }

    // Check custom URL patterns (from options page)
    for (const customPattern of customUrlPatterns) {
        if (lowerText.includes(customPattern.toLowerCase())) {
            matchedPatterns.push(`custom:${customPattern}`);
        }
    }

    if (matchedPatterns.length > 0) {
        return {
            isSpam: true,
            riskLevel: RISK_LEVELS.HIGH,
            matchedPatterns
        };
    }

    // Check medium-risk patterns
    for (const pattern of MEDIUM_RISK_URL_PATTERNS) {
        if (pattern.test(text)) {
            matchedPatterns.push(pattern.toString());
        }
    }

    if (matchedPatterns.length > 0) {
        return {
            isSpam: true,
            riskLevel: hasSafeUrl ? RISK_LEVELS.LOW : RISK_LEVELS.MEDIUM,
            matchedPatterns
        };
    }

    return {
        isSpam: false,
        riskLevel: RISK_LEVELS.SAFE,
        matchedPatterns: []
    };
}

/**
 * Calculate spam score based on keyword weights
 * @param {string} text - Text to analyze
 * @returns {{score: number, matchedKeywords: Object}}
 */
function calculateSpamScore(text) {
    if (!text) return { score: 0, matchedKeywords: {} };

    const lowerText = text.toLowerCase();
    let score = 0;
    const matchedKeywords = {};

    for (const [keyword, weight] of Object.entries(SPAM_KEYWORD_WEIGHTS)) {
        const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        const matches = lowerText.match(regex);

        if (matches) {
            score += weight * matches.length;
            matchedKeywords[keyword] = {
                weight,
                count: matches.length,
                contribution: weight * matches.length
            };
        }
    }

    // Check custom keywords (from options page)
    for (const [keyword, weight] of Object.entries(customKeywords)) {
        const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        const matches = lowerText.match(regex);

        console.log(`XSpamSweeper: Checking custom keyword "${keyword}" in text "${lowerText.substring(0, 50)}..."`,
            { regex: regex.toString(), matches });

        if (matches) {
            score += weight * matches.length;
            matchedKeywords[`custom:${keyword}`] = {
                weight,
                count: matches.length,
                contribution: weight * matches.length
            };
        }
    }

    return { score, matchedKeywords };
}

/**
 * Get overall spam risk level for a message
 * Combines URL patterns and keyword scoring
 * @param {string} text - Message text to analyze
 * @returns {{riskLevel: string, score: number, urlMatch: Object, keywordMatch: Object, isHiddenLink: boolean}}
 */
function getSpamInfo(text) {
    // Check for "Sent a link" placeholder (hidden link)
    const isHiddenLink = text && /^sent a link$/i.test(text.trim());

    // Check URL patterns
    const urlMatch = checkUrlPatterns(text);

    // Calculate keyword score
    const keywordMatch = calculateSpamScore(text);

    // Add score bonus for URL pattern matches
    let totalScore = keywordMatch.score;
    if (urlMatch.riskLevel === RISK_LEVELS.HIGH) {
        totalScore += 15; // High-risk URL = 15 points
    } else if (urlMatch.riskLevel === RISK_LEVELS.MEDIUM) {
        totalScore += 8;  // Medium-risk URL = 8 points
    }

    // Determine overall risk level
    let riskLevel = RISK_LEVELS.SAFE;

    if (urlMatch.riskLevel === RISK_LEVELS.HIGH) {
        riskLevel = RISK_LEVELS.HIGH;
    } else if (urlMatch.riskLevel === RISK_LEVELS.MEDIUM || totalScore >= 10) {
        riskLevel = RISK_LEVELS.MEDIUM;
    } else if (totalScore >= 3 || isHiddenLink) {  // 3 = 10% of max (30)
        riskLevel = RISK_LEVELS.LOW;
    }

    return {
        riskLevel,
        score: totalScore,
        urlMatch,
        keywordMatch,
        isHiddenLink
    };
}

/**
 * Check if message should be auto-flagged for sweep
 * @param {string} text - Message text
 * @returns {boolean}
 */
function shouldAutoFlag(text) {
    const info = getSpamInfo(text);
    return info.riskLevel === RISK_LEVELS.HIGH;
}
