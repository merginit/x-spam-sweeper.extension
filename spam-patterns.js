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
    /([01]inance|c[0o]inbase|met[a4]m[a4]sk|tr[u0]st|w[a4]llet)/i,
    /admireme\.vip/i,
    /adulttime\.com/i,
    /api\.whatsapp\.com/i,    // WhatsApp API links
    /b1anca\.com/i,           // Aggressive Model
    /binance\-/i,             // Fake Binance domains
    /biolnk\.at/i,
    /carrd\.co/i,
    /chat\.whatsapp\.com/i,   // WhatsApp groups
    /claim\-/i,
    /coinbase\-/i,            // Fake Coinbase domains
    /dapp\-/i,
    /direct\.me/i,
    /fancentro\.com/i,
    /fans\.ly/i,
    /fansly\.com/i,
    /fanvue\.com/i,
    /iwantclips\.com/i,
    /justfor\.fans/i,
    /lnk\.bio/i,
    /loyalfans\.com/i,
    /maloum\.com/i,
    /manyvids\.com/i,
    /metamask\-/i,            // Fake MetaMask domains
    /msha\.ke/i,
    /my\.club/i,
    /my69private\.site/i,
    /mym\.fans/i,
    /onlyfans\.com/i,
    /onsx\.fun/i,
    /pancakeswap\-/i,
    /phantom\-/i,
    /revoke\.cash/i,
    /sextpanther\.com/i,
    /slushy\.com/i,
    /socialtap\.me/i,
    /t\.me\//i,               // Telegram
    /taplink\.cc/i,
    /telegram\.me/i,          // Telegram alternative
    /telegram\.org/i,
    /throne\.com/i,
    /trustwallet/i,
    /uniswap\-/i,
    /wa\.me\//i,              // WhatsApp shortlinks
    /walletconnect/i,
];

/**
 * Medium-risk URL patterns (suspicious, needs review)
 * Generic shorteners and invite links
 */
const MEDIUM_RISK_URL_PATTERNS = [
    /\/airdrop/i,
    /\/crypto/i,
    /\/giveaway/i,
    /\/investment/i,
    /\/trading/i,
    /adf\.ly\//i,
    /allmylinks\.com/i,
    /allmysocial\.me/i,
    /beacons\.ai/i,
    /bio\.link/i,
    /bio\.site/i,
    /bit\.do/i,
    /bit\.ly\//i,
    /bl\.ink/i,
    /buff\.ly\//i,
    /claimmysocial\.com/i,
    /clck\.ru/i,
    /cli\.re/i,
    /curiouscat\.qa/i,
    /cutt\.ly/i,
    /discord\.com\/invite/i,
    /discord\.gg\//i,
    /dub\.sh/i,
    /etmysocial\.me/i,
    /feedlink\.io/i,
    /flow\.page/i,
    /getmysocial\.click/i,
    /getmysocial\.com/i,
    /getmysocial\.ink/i,
    /getmysocial\.net/i,
    /getmysociale\.com/i,
    /getmysocials\.me/i,
    /getmysocials\.net/i,
    /gg\.gg/i,
    /gmscl\.com/i,
    /gmysocial\.com/i,
    /goo\.by/i,
    /goo\.gl\//i,
    /heyl\.ink/i,
    /hypel\.ink/i,
    /is\.gd\//i,
    /joy\.link/i,
    /justallmy\.link/i,
    /line\.me/i,
    /linktr\.ee/i,
    /lit\.link/i,
    /lnk\.to/i,
    /mybios\.io/i,
    /ngl\.link/i,
    /onlysites\.co/i,
    /ow\.ly\//i,
    /rb\.gy/i,
    /rebrand\.ly/i,
    /s\.id/i,
    /shor\.by/i,
    /shorte\.st/i,
    /shorturl\.at/i,
    /short\.gy/i,
    /signal\.group/i,
    /sleek\.bio/i,
    /snapchat\.com\/add/i,
    /snip\.ly/i,
    /solo\.to/i,
    /start\.page/i,
    /t\.ly\//i,
    /tapfor\.social/i,
    /tapforallmylinks\.com/i,
    /tapformy\.social/i,
    /tellonym\.me/i,
    /thisismy\.social/i,
    /tiny\.cc/i,
    /tinyurl\.com/i,
    /touchmy\.social/i,
    /unlockmysocial\.com/i,
    /url\.bio/i,
    /v\.gd/i,
    /wa\.link/i,
    /wlo\.link/i,
    /znap\.link/i,
];

/**
 * Safe domains (whitelist) - Won't trigger spam flags
 */
const SAFE_DOMAINS = [
    'bandcamp.com',
    'buymeacoffee.com',
    'facebook.com',
    'github.com',
    'instagram.com',
    'ko-fi.com',
    'linkedin.com',
    'medium.com',
    'patreon.com',
    'reddit.com',
    'soundcloud.com',
    'spotify.com',
    'substack.com',
    'tiktok.com',
    'twitch.tv',
    'twitter.com',
    'x.com',
    'youtu.be',
    'youtube.com',
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
    'till midnight': 4,
    'until midnight': 4,
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

    // Lazy AI / Overused Marketing Buzzwords (weight: 3)
    'game-changer': 3,
    'game changer': 3,
    'the real unlock': 3,
    'unlock the power': 3,
    'scaling to the moon': 3,

    // =========================================================================
    // 2024-2025 TRENDING SPAM PATTERNS
    // =========================================================================

    // Enhanced Crypto/Investment
    'mining pool': 4,
    'liquidity pool': 3,
    'staking rewards': 3,
    'new ico': 4,
    'pump and dump': 5,
    'risk-free': 4,
    'recovery phrase': 5,
    'private key': 5,
    'send me 1 eth': 5,
    'send me 1 btc': 5,
    'verify your wallet': 4,
    'security alert': 3,

    // Enhanced Romance/Pig Butchering
    'working overseas': 3,
    'in the military': 3,
    'oil rig': 4,
    'bad internet': 3,
    'recently widowed': 3,
    'medical emergency': 4,
    'customs fees': 4,
    'shipping fees': 3,
    'never felt this way': 3,
    'soulmate': 2,

    // Adult/Meetup scams
    'paid meetup': 4,
    'meetup available': 3,
    'gf experience': 4,
    'girlfriend experience': 4,
    'booking info': 2, // Often used by "agencies"
};

/**
 * Regex-based spam patterns for dynamic number matching
 * Each entry: [regex, weight, name]
 */
const SPAM_REGEX_PATTERNS = [
    // Crypto multiplier claims (100x, 1000x, etc.)
    [/\b\d+x\b/gi, 5, 'multiplier claim'],

    // Percentage return claims (e.g., "8875.5% returns", "200%-300% upside")
    [/\b\d+(?:\.\d+)?%(?:\s*[-–]\s*\d+(?:\.\d+)?%)?\s*(?:returns?|upside|profit|gains?)/gi, 5, 'percentage returns'],

    // Time-limited FOMO ("for the next 24h", "next 15 minutes", "free for 24 hours")
    [/(?:for the )?next\s+\d+\s*(?:h(?:ours?)?|min(?:utes?)?|days?)/gi, 4, 'time-limited offer'],
    [/free\s+(?:for\s+)?\d+\s*(?:h(?:ours?)?|min(?:utes?)?|days?)/gi, 4, 'free time-limited'],

    // First N people/spots ("first 150", "first 50 members")
    [/\bfirst\s+\d+\b/gi, 4, 'first N spots'],

    // Stock trade records with buy/sell prices
    [/\bbuy:\s*[\d.]+/gi, 4, 'stock buy price'],
    [/\bsell:\s*[\d.]+/gi, 4, 'stock sell price'],

    // DM me N word ("DM me 1 word", "DM me one word")
    [/dm\s+me\s+(?:\d+|one|a)\s+word/gi, 4, 'dm trigger word'],

    // Countdown triggers ("in 8 sec", "in 5 seconds")
    [/in\s+\d+\s*sec(?:onds?)?/gi, 3, 'countdown trigger'],

    // Send crypto requests ("Send 0.1 ETH", "Deposit 500 USDT")
    [/(?:send|deposit)\s+\d+(?:\.\d+)?\s*(?:eth|btc|sol|bnb|usdt|usdc)/gi, 5, 'crypto deposit request'],

    // "Check bio" variations
    [/check\s*(?:my)?\s*bio/gi, 2, 'check bio'],
    [/link\s*(?:is)?\s*in\s*(?:my)?\s*bio/gi, 3, 'link in bio'],
];

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

    // Check regex-based patterns (dynamic numbers, percentages, etc.)
    for (const [pattern, weight, name] of SPAM_REGEX_PATTERNS) {
        const matches = text.match(pattern);
        if (matches) {
            score += weight * matches.length;
            matchedKeywords[`regex:${name}`] = {
                weight,
                count: matches.length,
                contribution: weight * matches.length,
                matches: matches.slice(0, 3)
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
