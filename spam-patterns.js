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
// Guard to prevent redeclaration in multi-frame contexts
// eslint-disable-next-line no-var
var customUrlPatterns = customUrlPatterns || [];
// eslint-disable-next-line no-var
var customKeywords = customKeywords || {};

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
    /my69private\.site/i,
    /b1anca\.com/i,
    /onsx\.fun/i,
    /j28t\.site/i,
    /p78t\.com/i,
    /slushy\.com/i,
    /fans\.ly/i,

    // NSFW / Adult Funnels (link aggregators heavily used by adult bots)
    /carrd\.co/i,
    /lnk\.bio/i,
    /taplink\.cc/i,
    /msha\.ke/i,
    /direct\.me/i,
    /socialtap\.me/i,
    /biolnk\.at/i,

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
    /claim\-/i,
    /pancakeswap\-/i,
    /uniswap\-/i,
    /walletconnect/i,
    /trustwallet/i,
    /revoke\.cash/i,
    /dapp\-/i,
    /phantom\-/i,

    // Lookalike domains (Punycode/misspellings of high-value targets)
    /([01]inance|c[0o]inbase|met[a4]m[a4]sk|tr[u0]st|w[a4]llet)/i,
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
    /t\.ly\//i,
    /dub\.sh/i,
    /rb\.gy/i,
    /shorturl\.at/i,
    /tiny\.cc/i,
    /gg\.gg/i,
    /bit\.do/i,
    /rebrand\.ly/i,
    /snip\.ly/i,
    /v\.gd/i,

    // Link aggregators (often used by spam/promo accounts)
    /allmylinks\.com/i,
    /getmysocial\.com/i,
    /beacons\.ai/i,
    /solo\.to/i,
    /linktr\.ee/i,
    /onlysites\.co/i,
    /tapforallmylinks\.com/i,
    /mybios\.io/i,
    /justallmy\.link/i,
    /getmysocial\.click/i,

    // Messaging "bridge" links (pig-butchering and NSFW scams)
    /line\.me/i,
    /signal\.group/i,
    /snapchat\.com\/add/i,

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

    // Pig Butchering / Long-con investment tactics
    'liquidity': 3,
    'passive returns': 4,
    'portfolio manager': 3,
    'signal group': 4,
    'insider trade': 4,
    'mentorship': 3,
    'wealth creation': 3,
    'seed phrase': 5,
    'connect wallet': 5,
    'gas fee': 3,
    'reimbursement': 3,

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

    // Romance scam indicators (weight: 2-5)
    'lonely': 2,
    'looking for love': 3,
    'sugar daddy': 4,
    'sugar mommy': 4,
    'sugar baby': 3,
    'allowance': 2,
    'spoil you': 3,
    'spoiling': 3,
    'verification fee': 5,
    'gas money': 3,
    'hey hun': 3,
    'bored at home': 2,

    // Adult content promotion (weight: 3-4)
    'onlyfans': 4,
    'fansly': 4,
    'link in bio': 2,
    'link in my bio': 3,
    'check my profile': 2,
    'check my pinned': 3,
    'exclusive content': 3,
    'subscribe': 2,
    'sub to me': 3,
    'live show': 4,
    'sexting': 4,
    'private session': 3,
    'top 0%': 3,
    'uncensored': 3,
    'raw photos': 4,
    'raw vids': 4,
    'no panties': 4,
    'completely free': 3,
    'free profile': 3,
    'free trial': 2,
    'free for 24': 4,
    'free just for': 3,
    'free till midnight': 4,
    'cumslut': 5,
    'nude chat': 5,
    'private followers': 3,
    'private page': 3,
    'filthy side': 4,
    'filthy lil': 4,
    'drenched': 3,
    'spreadin': 4,
    'going wild on myself': 5,
    'taboo secrets': 4,
    'curvy body': 2,
    'perky boobs': 4,
    'tight pussy': 5,
    'tight holes': 5,
    'playing with my': 3,
    'using my toy': 4,
    'between my legs': 4,
    'bent over': 3,
    'ass up': 4,
    'bustin hard': 4,
    'make you throb': 5,
    'dripping': 3,
    'gushing': 3,
    'slippery': 3,
    'instantly wet': 4,
    'bimbo mode': 4,

    // Engagement bait openers (weight: 2-4)
    'are you busy': 2,
    'special question': 3,
    'hope this message meets you well': 4,
    'friendly stranger': 3,
    'don\'t be shy': 2,
    'tell me something': 2,
    'temptation': 2,
    'nervous typing this': 3,
    'can\'t wait to see your name': 4,
    'finally sees': 2,
    'i hope this finds you well': 3,
    'can i ask you something': 2,
    'can i ask u something': 2,
    'is it fine if i ask': 2,
    'quick question but be honest': 3,
    'random but u seem': 3,
    'this is random but': 2,
    'hey random but': 2,
    'real quick': 2,
    'be honest would u': 3,
    'you seem familiar': 2,
    'do we know each other': 2,
    'i noticed you': 2,
    'spotted your comment': 3,
    'noticed your comment': 3,
    'saw your comment': 2,
    'saw ur comment': 2,
    'ur comment': 2,
    'your comment turned me': 4,
    'couldn\'t help but spot': 3,
    'you look cute': 2,
    'you looked cute': 2,
    'u look like the sorta': 3,
    'you seem like my type': 3,
    'you give energy': 2,
    'this might sound weird': 2,
    'okay confession': 3,
    'new here': 2,
    'not very active here': 3,
    'reaching out from a backup': 4,

    // FOMO/Urgency scam tactics (weight: 3-5)
    'for the next 24h': 4,
    'next 24 hours': 4,
    'next 15 minutes': 5,
    'till midnight': 4,
    'until midnight': 4,
    'first 150': 4,
    'limited verification': 4,
    'free verification phase': 5,
    'direct path to': 3,
    'your access is waiting': 4,
    'begin free now': 4,
    'join for free': 2,
    'your likes': 2,
    'makes me throb': 5,

    // Stock/Investment pump schemes (weight: 4-5)
    'stock blogger': 5,
    'reliable stock': 4,
    'market analysis team': 5,
    'stocks buying and selling': 5,
    'trade setups': 4,
    'stock list': 3,
    'high-conviction': 4,
    'crypto signals': 4,
    'stock signals': 4,
    'returns is now live': 5,
    'transform potential into profit': 5,
    'never recommends junk': 4,
    'valuable investing': 3,
    'exclusive investment': 4,
    'exclusive report': 3,
    'way better than researching': 4,
    'buy:': 3,
    'sell:': 3,
    'upside': 2,

    // Fake intimacy/Romance hooks (weight: 2-4)
    'hey cutie': 2,
    'hey handsome': 2,
    'hey gorgeous': 2,
    'hey love': 2,
    'hey babe': 2,
    'hello handsome': 2,
    'hello gorgeous': 2,
    'hi cutie': 2,
    'thinking of you': 2,
    'imagining you': 3,
    'craving': 2,
    'needy': 2,
    'desperate for touch': 4,
    'sensitive and needy': 3,
    'hot and bothered': 3,
    'playing with myself': 4,
    'touching myself': 4,
    'one click away': 3,
    'come prove me right': 3,
    'come get what you do': 3,
    'come sub now': 4,
    'come see': 2,
    'door wide open': 3,
    'i\'ll take the lead': 2,
    'tap the link': 2,
    'hit the link': 2,
    'click when you want': 3,
    'press the picture': 3,
    'hit my pic': 3,

    // Explicit adult solicitation (weight: 4-5)
    'dm me 1 word': 4,
    'dm me on of': 4,
    'slide into': 2,
    'invaded your dms': 4,
    'obey me': 3,
    'slave': 3,
    'dominance': 2,
    'behave or misbehave': 3,
    'quit staring': 3,
    'stop behaving': 3,
    'deserve it': 2,
    'nasty you\'ll be addicted': 5,
    'welcome video': 3,
    'full reveal': 3,
    'real treat': 2,
    'unwrap the rest': 3,
    'what i\'m hiding': 3,

    // Vague teaser hooks (weight: 2-3)
    'i need to tell you something': 2,
    'it will be short': 2,
    'this shot is merely': 3,
    'the photo cuts off': 3,
    'kept the rest uncensored': 4,
    'didn\'t show here': 2,
    'you got this far': 2,
    'don\'t dare stop': 3,
    'still here still soft': 3,
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
 * @returns {{isSpam: boolean, riskLevel: string, matchedPatterns: string[], hasSafeUrl: boolean}}
 */
function checkUrlPatterns(text) {
    if (!text) return { isSpam: false, riskLevel: RISK_LEVELS.SAFE, matchedPatterns: [], hasSafeUrl: false };

    const lowerText = text.toLowerCase();
    const matchedPatterns = [];

    // Check for safe domains first
    const hasSafeUrl = SAFE_DOMAINS.some(domain => lowerText.includes(domain));

    // Check high-risk patterns (Instant Red Flag)
    for (const pattern of HIGH_RISK_URL_PATTERNS) {
        if (pattern.test(text)) {
            matchedPatterns.push(pattern.toString());
        }
    }

    // Check custom URL patterns
    for (const customPattern of customUrlPatterns) {
        if (lowerText.includes(customPattern.toLowerCase())) {
            matchedPatterns.push(`custom:${customPattern}`);
        }
    }

    // If High Risk or Custom match found -> HIGH
    if (matchedPatterns.length > 0) {
        return {
            isSpam: true,
            riskLevel: RISK_LEVELS.HIGH,
            matchedPatterns,
            hasSafeUrl
        };
    }

    // Check medium-risk patterns
    for (const pattern of MEDIUM_RISK_URL_PATTERNS) {
        if (pattern.test(text)) {
            matchedPatterns.push(pattern.toString());
        }
    }

    if (matchedPatterns.length > 0) {
        // If we found a Medium pattern (like bit.ly) BUT also a Safe pattern (youtube),
        // we lean towards Low risk, but still flag it because redirects are suspicious.
        return {
            isSpam: true,
            riskLevel: hasSafeUrl ? RISK_LEVELS.LOW : RISK_LEVELS.MEDIUM,
            matchedPatterns,
            hasSafeUrl
        };
    }

    return {
        isSpam: false,
        riskLevel: RISK_LEVELS.SAFE,
        matchedPatterns: [],
        hasSafeUrl
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
 * Combines URL patterns and keyword scoring with 0-30 calibration
 * @param {string} text - Message text to analyze
 * @returns {{riskLevel: string, score: number, urlMatch: Object, keywordMatch: Object, isHiddenLink: boolean}}
 */
function getSpamInfo(text) {
    // 1. Detect "Sent a link" placeholder
    // This is a blind spot. We assign it a base SUS score.
    const isHiddenLink = text && /^sent a link$/i.test(text.trim());

    // 2. Analyze URLs
    const urlMatch = checkUrlPatterns(text);

    // 3. Analyze Keywords
    const keywordMatch = calculateSpamScore(text);

    let totalScore = keywordMatch.score;

    // --- SCORING CALIBRATION (0 to 30) ---

    if (isHiddenLink) {
        // Base score for hidden links. 
        // Logic: We don't know what it is, so it's SUS (10) by default.
        // If the background worker resolves it later, this re-runs with the real URL.
        totalScore += 10;
    }

    // High Risk URL (WhatsApp, Telegram, etc.) -> Instant +20
    if (urlMatch.riskLevel === RISK_LEVELS.HIGH) {
        totalScore += 20;
    }

    // Medium Risk URL (Shorteners, Discord) -> +10
    else if (urlMatch.riskLevel === RISK_LEVELS.MEDIUM) {
        totalScore += 10;
    }

    // Safe Domain Bonus (The "Friend" Safety Valve)
    // If it's YouTube/Spotify/GitHub, we subtract points.
    if (urlMatch.hasSafeUrl) {
        totalScore -= 10;
    }

    // Clamp score between 0 and 30
    totalScore = Math.min(Math.max(totalScore, 0), 30);

    // --- RISK LEVEL ASSIGNMENT ---
    let riskLevel = RISK_LEVELS.SAFE;

    if (totalScore >= 20) {
        riskLevel = RISK_LEVELS.HIGH;   // Red Badge (Definite Spam)
    } else if (totalScore >= 10) {
        riskLevel = RISK_LEVELS.MEDIUM; // Yellow Badge (SUS / Hidden Link)
    } else if (totalScore >= 3) {
        riskLevel = RISK_LEVELS.LOW;    // Grey Badge (Has link / Salesy)
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
 * Get spam info with optional AI enhancement
 * Async version that consults AI for "SUS zone" messages
 * @param {string} text - Message text to analyze
 * @returns {Promise<Object>} Enhanced spam info with optional AI verdict
 */
// eslint-disable-next-line no-unused-vars
async function getSpamInfoWithAI(text) {
    // 1. Fast path: Get heuristic score first
    const info = getSpamInfo(text);

    // 2. Check if AI scanning is available
    const scanWithAIFn = typeof scanWithAI === 'function' ? scanWithAI : null;
    if (!scanWithAIFn) {
        return info;
    }

    // 3. Decision gates - when to skip AI

    // Gate A: Already HIGH risk - no need for AI confirmation
    if (info.riskLevel === RISK_LEVELS.HIGH) {
        info.aiSkipped = 'already_high_risk';
        return info;
    }

    // Gate B: Very low score - don't bother AI with "hey" messages
    if (info.score < 5) {
        info.aiSkipped = 'score_too_low';
        return info;
    }

    // Gate C: Hidden link that hasn't been resolved yet
    if (info.isHiddenLink) {
        info.aiSkipped = 'hidden_link_unresolved';
        return info;
    }

    // 4. SUS zone (score 5-19) - consult AI for verdict
    info.aiChecked = true;

    try {
        const aiVerdict = await scanWithAIFn(text);

        if (!aiVerdict) {
            info.aiSkipped = 'ai_unavailable';
            return info;
        }

        info.aiVerdict = aiVerdict;

        // AI says SPAM with high confidence -> Upgrade to HIGH risk
        if (aiVerdict.isSpam && aiVerdict.confidence > 0.8) {
            console.log(`XSpamSweeper: AI upgraded score from ${info.score} to HIGH (${aiVerdict.category}: ${aiVerdict.reason})`);
            info.score = 25;
            info.riskLevel = RISK_LEVELS.HIGH;
            info.aiReason = `AI: ${aiVerdict.category} - ${aiVerdict.reason}`;
        }
        // AI says SAFE with high confidence -> Downgrade to SAFE
        else if (!aiVerdict.isSpam && aiVerdict.confidence > 0.8) {
            console.log(`XSpamSweeper: AI downgraded score from ${info.score} to SAFE (${aiVerdict.reason})`);
            info.score = 0;
            info.riskLevel = RISK_LEVELS.SAFE;
            info.aiReason = `AI cleared: ${aiVerdict.reason}`;
        }
        // AI is unsure -> Keep heuristic score
        else {
            console.log(`XSpamSweeper: AI uncertain (confidence: ${aiVerdict.confidence}), keeping heuristic score ${info.score}`);
        }

    } catch (error) {
        console.warn('XSpamSweeper: AI check failed', error);
        info.aiSkipped = 'ai_error';
    }

    return info;
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
