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

/**
 * Handle programmatic script injection for report iframe automation
 * This is needed because dynamically created iframes don't get manifest-based content scripts
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'injectReportHandler') {
        const tabId = request.tabId || sender.tab?.id;

        console.log('XSpamSweeper Background: Received inject request for tab', tabId);

        if (!tabId) {
            console.error('XSpamSweeper Background: No tab ID available');
            sendResponse({ success: false, message: 'No tab ID available' });
            return true;
        }

        // Inject script into all frames to handle the report iframe
        chrome.scripting.executeScript({
            target: { tabId: tabId, allFrames: true },
            func: handleReportIframeAutomation,
            args: []
        }).then(() => {
            console.log('XSpamSweeper: Injected report handler into all frames');
            sendResponse({ success: true });
        }).catch((error) => {
            console.error('XSpamSweeper: Failed to inject report handler', error);
            sendResponse({ success: false, message: error.message });
        });

        return true; // Keep channel open for async response
    }
});

/**
 * This function is injected into all frames to handle report automation.
 * It runs in the context of the page, not the extension.
 * 
 * NOTE: This function contains duplicated utility code (nativeClick, clickElementWithText, etc.)
 * that also exists in shared.js. This duplication is INTENTIONAL and UNAVOIDABLE because:
 * 1. chrome.scripting.executeScript() serializes this function to a string
 * 2. The serialized function runs in the target page's isolated context
 * 3. It has NO access to extension files like shared.js
 * 
 * Do not attempt to refactor this to use shared.js - it will break the injection.
 */
function handleReportIframeAutomation() {
    // Only run in the report iframe
    if (!window.location.href.includes('/i/safety/report_story')) {
        return;
    }

    console.log('XSpamSweeper: Report handler running in iframe');

    /**
     * Native click helper for React compatibility
     * Regular .click() is sometimes ignored by React components, so we simulate full event sequence
     */
    function nativeClick(element) {
        if (!element) return false;

        const eventTypes = [
            'pointerdown', 'mousedown',
            'pointerup', 'mouseup',
            'click'
        ];

        eventTypes.forEach(type => {
            const event = new MouseEvent(type, {
                view: window,
                bubbles: true,
                cancelable: true,
                buttons: 1,
                composed: true
            });
            element.dispatchEvent(event);
        });
        return true;
    }

    /**
     * Find and click an interactive element containing specific text
     * Traverses up from text matches to find clickable parents
     */
    function clickElementWithText(text, tags = ['BUTTON', 'A', 'INPUT', 'DIV']) {
        // Normalize quotes in search text
        const lowerText = text.toLowerCase().replace(/[\u2018\u2019]/g, "'");

        // Strategy: Find all elements containing the text
        const allElements = document.querySelectorAll('*');
        let candidates = [];

        for (const el of allElements) {
            const content = el.textContent.toLowerCase().replace(/[\u2018\u2019]/g, "'");

            if (el.children.length === 0 && content.includes(lowerText)) {
                candidates.push(el);
            } else if (el.childNodes.length > 0) {
                // Check immediate text nodes
                for (const node of el.childNodes) {
                    if (node.nodeType === Node.TEXT_NODE) {
                        const nodeContent = node.textContent.toLowerCase().replace(/[\u2018\u2019]/g, "'");
                        if (nodeContent.includes(lowerText)) {
                            candidates.push(el);
                            break;
                        }
                    }
                }
            }
        }

        if (candidates.length === 0) return false;

        console.log(`XSpamSweeper: Found ${candidates.length} candidates for text "${text}"`);
        // Debug: Visual feedback
        candidates.forEach(c => c.style.border = "2px solid red");

        // Sort to prioritize buttons/links
        candidates.sort((a, b) => {
            const getScore = (el) => {
                let score = 0;
                let curr = el;
                for (let i = 0; i < 5; i++) {
                    if (!curr) break;
                    const tag = curr.tagName;
                    const role = curr.getAttribute('role');
                    if (tag === 'BUTTON' || tag === 'A' || tag === 'INPUT') score += 10;
                    if (role === 'button' || role === 'link' || role === 'menuitem') score += 5;
                    curr = curr.parentElement;
                }
                return score;
            };
            return getScore(b) - getScore(a);
        });

        let anyClicked = false;

        for (const candidate of candidates) {
            console.log(`XSpamSweeper: Attacking candidate <${candidate.tagName}> for "${text}"`);

            let current = candidate;
            let clickedInChain = 0;

            // 1. Click the text node container itself first
            nativeClick(current);

            // 2. Traverse up and click parents
            for (let i = 0; i < 7; i++) {
                if (!current.parentElement) break;
                current = current.parentElement;

                if (current.tagName === 'BODY' || current.tagName === 'HTML' || current.tagName === 'IFRAME') break;

                // Visual debug
                current.style.border = "2px solid orange";

                nativeClick(current);
                clickedInChain++;
            }

            if (clickedInChain > 0) anyClicked = true;
        }

        return anyClicked;
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function clickSubmitButtons(maxAttempts = 6) {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            await delay(700);

            console.log(`XSpamSweeper: Looking for submit/next buttons (attempt ${attempt + 1})`);

            const buttonTexts = ['Next', 'Submit', 'Report', 'Block', 'Done', 'Send report to X'];
            let clicked = false;

            for (const text of buttonTexts) {
                if (clickElementWithText(text, ['BUTTON', 'DIV'])) {
                    console.log(`XSpamSweeper: Clicked button "${text}"`);
                    clicked = true;
                    break;
                }
            }

            if (clicked) {
                await delay(800);
                return true;
            }
        }
        return false;
    }

    async function automateSpamReport() {
        console.log('XSpamSweeper: Starting spam report automation in iframe');

        // Try to find and click Spam option (with retries)
        for (let attempt = 0; attempt < 15; attempt++) {
            await delay(500);

            const spans = document.querySelectorAll('span');
            for (const span of spans) {
                const text = span.textContent.trim().toLowerCase();
                if (text.includes('spam') && !text.includes('learn')) {
                    console.log('XSpamSweeper: Found spam option:', span.textContent);

                    // Click the span itself
                    nativeClick(span);

                    // Also try to find and click the parent list item/button
                    const parentButton = span.closest('[role="button"], [role="menuitem"], div[dir="ltr"]');
                    if (parentButton && parentButton !== span) {
                        console.log('XSpamSweeper: Clicking parent element');
                        nativeClick(parentButton);
                    }

                    // Wait and look for submit buttons
                    await delay(800);
                    await clickSubmitButtons();
                    return true;
                }
            }

            console.log(`XSpamSweeper: Spam option not found, attempt ${attempt + 1}/15`);
        }

        console.log('XSpamSweeper: Could not find Spam option');
        return false;
    }

    automateSpamReport();
}

let linkResolutionQueue = [];
let isProcessingQueue = false;
let workerTabId = null;
let workerWindowId = null;

/**
 * Handle link resolution requests from content script
 */
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.action === 'resolveSentLinks') {
        console.log('XSpamSweeper Background: Received link resolution request for', request.users?.length, 'users');

        if (!request.users || request.users.length === 0) {
            sendResponse({ success: false, message: 'No users to process' });
            return true;
        }

        // Add to queue and start processing
        linkResolutionQueue.push(...request.users);
        processLinkResolutionQueue();

        sendResponse({ success: true, message: `Queued ${request.users.length} users for link resolution` });
        return true;
    }

    if (request.action === 'getLinkResolutionStatus') {
        sendResponse({
            queueLength: linkResolutionQueue.length,
            isProcessing: isProcessingQueue,
            workerTabActive: workerTabId !== null
        });
        return true;
    }

    if (request.action === 'cancelLinkResolution') {
        linkResolutionQueue = [];
        if (workerWindowId) {
            chrome.windows.remove(workerWindowId).catch(() => { });
            workerWindowId = null;
            workerTabId = null;
        }
        isProcessingQueue = false;
        sendResponse({ success: true, message: 'Link resolution cancelled' });
        return true;
    }
});

/**
 * Process the link resolution queue
 */
async function processLinkResolutionQueue() {
    if (isProcessingQueue) return;
    if (linkResolutionQueue.length === 0) return;

    isProcessingQueue = true;
    console.log('XSpamSweeper Background: Starting link resolution queue processing');

    try {
        // Create a minimized popup window to hide link extraction from user
        // Using chrome.windows.create + immediate update because state: "minimized" 
        // has a known Chromium bug where it doesn't work reliably during creation
        const workerWindow = await chrome.windows.create({
            url: 'about:blank',
            type: 'popup',
            width: 800,
            height: 600,
            focused: false
        });
        workerWindowId = workerWindow.id;
        workerTabId = workerWindow.tabs[0].id;

        // Immediately minimize the window to hide it from user
        await chrome.windows.update(workerWindowId, {
            state: 'minimized',
            focused: false
        });
        console.log('XSpamSweeper Background: Created minimized worker window', workerWindowId, 'with tab', workerTabId);

        // First, extract current user's own profile links to filter them out later
        let currentUserDomains = [];
        try {
            console.log('XSpamSweeper Background: Extracting current user profile links...');
            // Navigate to home to find the profile link
            await chrome.tabs.update(workerTabId, { url: 'https://x.com/home' });
            await waitForTabLoad(workerTabId);
            await new Promise(r => setTimeout(r, 2000));

            // Get current username
            const usernameResult = await chrome.scripting.executeScript({
                target: { tabId: workerTabId },
                func: function () {
                    const profileLink = document.querySelector('[data-testid="AppTabBar_Profile_Link"]');
                    const href = profileLink?.getAttribute('href');
                    return href ? href.substring(1).split('/')[0] : null;
                }
            });
            const currentUsername = usernameResult?.[0]?.result;

            if (currentUsername) {
                console.log(`XSpamSweeper Background: Current user is @${currentUsername}`);
                // Navigate to their profile
                await chrome.tabs.update(workerTabId, { url: `https://x.com/${currentUsername}` });
                await waitForTabLoad(workerTabId);
                await new Promise(r => setTimeout(r, 2000));

                // Extract domains from bio and website
                const domainsResult = await chrome.scripting.executeScript({
                    target: { tabId: workerTabId },
                    func: function () {
                        const domains = new Set();

                        // Helper to extract domain from text (handles https://domain.com or domain.com)
                        function extractDomain(text) {
                            if (!text) return null;
                            // Remove https:// or http://
                            let domain = text.trim().replace(/^https?:\/\//i, '');
                            // Remove path/query
                            domain = domain.split('/')[0].split('?')[0];
                            // Check if it's a valid domain
                            if (domain.match(/^[a-z0-9.-]+\.[a-z]{2,}$/i)) {
                                return domain.toLowerCase();
                            }
                            return null;
                        }

                        // Get domains from bio links
                        document.querySelectorAll('[data-testid="UserDescription"] a[href]').forEach(a => {
                            const text = a.textContent?.trim();
                            const domain = extractDomain(text);
                            if (domain) {
                                domains.add(domain);
                                console.log('XSpamSweeper: Found bio domain:', domain, 'from text:', text);
                            }
                        });

                        // Get domain from website link
                        const userUrl = document.querySelector('[data-testid="UserUrl"]');
                        if (userUrl) {
                            const text = userUrl.textContent?.trim();
                            const domain = extractDomain(text);
                            if (domain) {
                                domains.add(domain);
                                console.log('XSpamSweeper: Found website domain:', domain, 'from text:', text);
                            }
                        }

                        console.log('XSpamSweeper: Current user domains:', [...domains]);
                        return [...domains];
                    }
                });
                currentUserDomains = domainsResult?.[0]?.result || [];
                console.log('XSpamSweeper Background: Current user domains:', currentUserDomains);
            }
        } catch (error) {
            console.warn('XSpamSweeper Background: Could not extract current user domains:', error);
        }

        while (linkResolutionQueue.length > 0) {
            const username = linkResolutionQueue.shift();

            try {
                const result = await resolveUserLink(workerTabId, username);
                console.log(`XSpamSweeper Background: Resolved @${username}:`, result);

                // Resolve t.co shortlinks to actual URLs using webRequest (safe - doesn't load destination)
                if (result.links && result.links.length > 0) {
                    const resolvedLinks = [];
                    for (const link of result.links) {
                        if (link.includes('t.co/')) {
                            try {
                                // Use webRequest to capture redirect WITHOUT loading destination page
                                const resolvedUrl = await new Promise((resolve) => {
                                    let redirectUrl = null;

                                    // Listen for the redirect
                                    const listener = (details) => {
                                        if (details.tabId === workerTabId && details.redirectUrl) {
                                            redirectUrl = details.redirectUrl;
                                            // Cancel the request to prevent loading destination
                                            chrome.tabs.update(workerTabId, { url: 'about:blank' }).catch(() => { });
                                        }
                                    };

                                    chrome.webRequest.onBeforeRedirect.addListener(
                                        listener,
                                        { urls: ['*://t.co/*'], tabId: workerTabId }
                                    );

                                    // Navigate to t.co link
                                    chrome.tabs.update(workerTabId, { url: link });

                                    // Wait for redirect or timeout
                                    setTimeout(() => {
                                        chrome.webRequest.onBeforeRedirect.removeListener(listener);
                                        resolve(redirectUrl || link);
                                    }, 3000);
                                });

                                if (resolvedUrl && !resolvedUrl.includes('t.co/')) {
                                    console.log(`XSpamSweeper Background: Resolved ${link} -> ${resolvedUrl}`);
                                    resolvedLinks.push(resolvedUrl);
                                } else {
                                    resolvedLinks.push(link);
                                }
                            } catch (e) {
                                console.warn(`XSpamSweeper Background: Failed to resolve ${link}:`, e.message);
                                resolvedLinks.push(link);
                            }
                        } else {
                            resolvedLinks.push(link);
                        }
                    }
                    // Deduplicate resolved links
                    result.links = [...new Set(resolvedLinks)];
                    console.log(`XSpamSweeper Background: After t.co resolution for @${username}: ${result.links.length} unique links:`, result.links);
                }

                // Filter out the current user's own domains from the results
                if (result.links && result.links.length > 0 && currentUserDomains.length > 0) {
                    const originalCount = result.links.length;
                    result.links = result.links.filter(link => {
                        // Extract domain from the link
                        const match = link.match(/https?:\/\/([^\/]+)/i);
                        const linkDomain = match ? match[1].toLowerCase() : '';
                        // Check if this domain matches any user domain
                        const isUserDomain = currentUserDomains.some(userDomain =>
                            linkDomain === userDomain ||
                            linkDomain.endsWith('.' + userDomain) ||
                            link.toLowerCase().includes(userDomain)
                        );
                        return !isUserDomain;
                    });
                    if (result.links.length < originalCount) {
                        console.log(`XSpamSweeper Background: Filtered out ${originalCount - result.links.length} user domain links for @${username}`);
                    }
                }

                // Store resolved links in chrome.storage
                if (result.links && result.links.length > 0) {
                    const storage = await chrome.storage.local.get(['resolvedLinks']);
                    const resolvedLinks = storage.resolvedLinks || {};
                    resolvedLinks[username] = {
                        links: result.links,
                        resolvedAt: Date.now()
                    };
                    await chrome.storage.local.set({ resolvedLinks });
                    console.log(`XSpamSweeper Background: Stored ${result.links.length} links for @${username}`);
                }

                // Notify any listening tabs about the resolution
                chrome.runtime.sendMessage({
                    action: 'linkResolved',
                    username,
                    result
                }).catch(() => { });

            } catch (error) {
                console.error(`XSpamSweeper Background: Failed to resolve @${username}:`, error);
            }

            // Rate limiting delay between users (3 seconds)
            if (linkResolutionQueue.length > 0) {
                await new Promise(r => setTimeout(r, 3000));
            }
        }

        // Cleanup: close worker window
        if (workerWindowId) {
            await chrome.windows.remove(workerWindowId).catch(() => { });
            workerWindowId = null;
            workerTabId = null;
        }

    } catch (error) {
        console.error('XSpamSweeper Background: Queue processing error:', error);
    } finally {
        isProcessingQueue = false;
        workerWindowId = null;
        workerTabId = null;
    }
}

/**
 * Resolve the actual link for a single user
 * @param {number} tabId - Worker tab ID
 * @param {string} username - Twitter username
 * @returns {Promise<{links: string[], spamInfo: Object}>}
 */
async function resolveUserLink(tabId, username) {
    // Sanitize username - remove @ if present
    const cleanUsername = username.replace(/^@/, '');
    console.log(`XSpamSweeper Background: Resolving links for @${cleanUsername}`);

    return new Promise(async (resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Timeout'));
        }, 25000);

        try {
            // Navigate to user's profile
            await chrome.tabs.update(tabId, { url: `https://x.com/${cleanUsername}` });

            // Wait for page load
            await waitForTabLoad(tabId);
            await new Promise(r => setTimeout(r, 2500));

            // Inject script to click Message button and extract links
            const results = await chrome.scripting.executeScript({
                target: { tabId },
                func: extractLinksFromProfile
            });

            clearTimeout(timeout);

            if (results && results[0]?.result) {
                resolve(results[0].result);
            } else {
                resolve({ links: [], spamInfo: null, error: 'No results' });
            }

        } catch (error) {
            clearTimeout(timeout);
            reject(error);
        }
    });
}

/**
 * Wait for a tab to finish loading
 */
function waitForTabLoad(tabId) {
    return new Promise((resolve) => {
        function listener(tid, info) {
            if (tid === tabId && info.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                resolve();
            }
        }
        chrome.tabs.onUpdated.addListener(listener);

        // Timeout fallback
        setTimeout(() => {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
        }, 10000);
    });
}

/**
 * This function is injected into the user's profile page
 * It clicks the Message button and extracts links from the existing conversation
 * Handles both old (data-testid) and new (Tailwind) X messaging UIs
 */
function extractLinksFromProfile() {
    return new Promise((resolve) => {
        // Native click helper for React compatibility
        function nativeClick(element) {
            if (!element) return false;
            element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
            element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
            element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
            element.click();
            return true;
        }

        // First check for sensitive content warning and click through it
        const sensitiveButton = document.querySelector('[data-testid="empty_state_button_text"]') ||
            document.querySelector('button[data-testid*="empty_state"]');

        if (sensitiveButton) {
            console.log('XSpamSweeper: Found sensitive content warning, clicking through...');
            nativeClick(sensitiveButton);
            // Wait a bit for the page to update
            setTimeout(() => continueWithMessageButton(), 1500);
        } else {
            continueWithMessageButton();
        }

        function continueWithMessageButton() {
            // Find the Message button - try multiple selectors for both UIs
            const msgBtn = document.querySelector('[data-testid="sendDMFromProfile"]') ||
                document.querySelector('[aria-label="Message"]') ||
                document.querySelector('button[aria-label*="Message"]') ||
                document.querySelector('button svg[data-icon*="message"]')?.closest('button');

            if (!msgBtn) {
                console.log('XSpamSweeper: Message button not found on profile');
                resolve({ links: [], error: 'Message button not found' });
                return;
            }

            console.log('XSpamSweeper: Found message button, clicking...');
            msgBtn.click();

            let attempts = 0;
            const maxAttempts = 20; // 10 seconds total

            const checkForMessages = setInterval(() => {
                attempts++;

                // Check if message content has loaded (either UI)
                const hasMessageContent =
                    document.querySelector('[data-testid="messageEntry"]') ||
                    document.querySelector('[data-testid="card.wrapper"]') ||
                    document.querySelector('[data-testid*="message-text"]') ||
                    document.querySelector('li[style*="position: absolute"]');

                console.log(`XSpamSweeper: Attempt ${attempts}/${maxAttempts}, hasMessageContent: ${!!hasMessageContent}`);

                if (hasMessageContent || attempts >= maxAttempts) {
                    clearInterval(checkForMessages);

                    const links = [];

                    // Strategy: Find message elements directly and extract links from each
                    // This avoids container detection issues

                    // OLD UI: Link cards with previews (these contain the actual spam links)
                    const cardWrappers = document.querySelectorAll('[data-testid="card.wrapper"]');
                    console.log(`XSpamSweeper: Found ${cardWrappers.length} card.wrapper elements`);
                    cardWrappers.forEach(card => {
                        // Get the t.co link from the card
                        const cardLink = card.querySelector('a[href]');
                        if (cardLink && cardLink.href) {
                            const href = cardLink.href;
                            if (!href.includes('x.com') && !href.includes('twitter.com') && !links.includes(href)) {
                                links.push(href);
                                console.log(`XSpamSweeper: Found card link: ${href}`);
                            }
                        }
                        // Also get the domain text displayed on the card (e.g., "allmylinks.com")
                        const domainDiv = card.querySelector('[data-testid="card.layoutSmall.detail"] div[dir="auto"]');
                        if (domainDiv) {
                            const domainText = domainDiv.textContent?.trim();
                            if (domainText && domainText.match(/^[a-z0-9.-]+\.[a-z]{2,}$/i)) {
                                const domainUrl = 'https://' + domainText;
                                if (!links.includes(domainUrl)) {
                                    links.push(domainUrl);
                                    console.log(`XSpamSweeper: Found card domain: ${domainUrl}`);
                                }
                            }
                        }
                    });

                    // OLD UI: Message entries (contain text with links)
                    const messageEntries = document.querySelectorAll('[data-testid="messageEntry"]');
                    console.log(`XSpamSweeper: Found ${messageEntries.length} messageEntry elements`);
                    messageEntries.forEach(entry => {
                        entry.querySelectorAll('a[href]').forEach(a => {
                            const href = a.href;
                            if (href && !href.includes('x.com') && !href.includes('twitter.com') &&
                                !href.startsWith('javascript:') && !links.includes(href)) {
                                links.push(href);
                                console.log(`XSpamSweeper: Found messageEntry link: ${href}`);
                            }
                        });
                    });

                    // NEW UI: Message text elements (data-testid contains "message-text")
                    const messageTexts = document.querySelectorAll('[data-testid*="message-text"]');
                    console.log(`XSpamSweeper: Found ${messageTexts.length} message-text elements`);
                    messageTexts.forEach(el => {
                        el.querySelectorAll('a[href]').forEach(a => {
                            const href = a.href;
                            if (href && !href.includes('x.com') && !href.includes('twitter.com') &&
                                !href.startsWith('javascript:') && !links.includes(href)) {
                                links.push(href);
                                console.log(`XSpamSweeper: Found message-text link: ${href}`);
                            }
                        });
                    });

                    // NEW UI: Look in list items that contain messages (position: absolute style)
                    const messageItems = document.querySelectorAll('li[style*="position: absolute"]');
                    console.log(`XSpamSweeper: Found ${messageItems.length} message list items (new UI)`);
                    messageItems.forEach(li => {
                        // Get links from anchors
                        li.querySelectorAll('a[href]').forEach(a => {
                            const href = a.href;
                            if (href && !href.includes('x.com') && !href.includes('twitter.com') &&
                                !href.startsWith('javascript:') && !links.includes(href)) {
                                links.push(href);
                                console.log(`XSpamSweeper: Found list item link: ${href}`);
                            }
                        });
                        // Also check for URL text in font-chirp elements
                        li.querySelectorAll('.font-chirp').forEach(el => {
                            const text = el.textContent?.trim() || '';
                            if (text.match(/^https?:\/\//i) && !text.includes('x.com') &&
                                !text.includes('twitter.com') && !links.includes(text)) {
                                links.push(text);
                                console.log(`XSpamSweeper: Found font-chirp URL: ${text}`);
                            }
                        });
                    });

                    console.log(`XSpamSweeper: Total ${links.length} unique links extracted after ${attempts} attempts`);

                    // Filter out irrelevant URLs
                    function isRelevantUrl(url) {
                        if (!url) return false;
                        const lowerUrl = url.toLowerCase();
                        if (lowerUrl.includes('w3.org/2000/svg') || lowerUrl.includes('w3.org/1999/xlink')) return false;
                        if (lowerUrl.includes('twimg.com') || lowerUrl.includes('twemoji.') ||
                            lowerUrl.includes('responsive-web/') || lowerUrl.includes('/client-web/')) return false;
                        if (lowerUrl.startsWith('javascript:') || lowerUrl.startsWith('about:') ||
                            lowerUrl.startsWith('data:') || lowerUrl.startsWith('blob:')) return false;
                        return true;
                    }

                    const filteredLinks = [...new Set(links)].filter(isRelevantUrl);
                    console.log(`XSpamSweeper: ${filteredLinks.length} links after filtering`);

                    resolve({
                        links: filteredLinks,
                        rawLinkCount: links.length,
                        messageCount: messageEntries.length || messageItems.length,
                        containerFound: true,
                        attempts
                    });
                }
            }, 500);
        } // End of continueWithMessageButton
    }); // End of Promise
}
