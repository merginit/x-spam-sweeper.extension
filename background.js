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
        if (workerTabId) {
            chrome.tabs.remove(workerTabId).catch(() => { });
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
        // Create a single worker tab
        const tab = await chrome.tabs.create({
            active: false,  // Make visible for debugging
            pinned: true,
            url: 'about:blank'
        });
        workerTabId = tab.id;
        console.log('XSpamSweeper Background: Created worker tab', workerTabId);

        while (linkResolutionQueue.length > 0) {
            const username = linkResolutionQueue.shift();

            try {
                const result = await resolveUserLink(workerTabId, username);
                console.log(`XSpamSweeper Background: Resolved @${username}:`, result);

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

        // Cleanup: close worker tab
        if (workerTabId) {
            await chrome.tabs.remove(workerTabId).catch(() => { });
            workerTabId = null;
        }

    } catch (error) {
        console.error('XSpamSweeper Background: Queue processing error:', error);
    } finally {
        isProcessingQueue = false;
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

                // Try multiple container selectors - handles BOTH old and new X UIs
                const containers = [
                    // Old UI selectors
                    document.querySelector('[data-testid="DMDrawer"]'),
                    document.querySelector('[data-testid="DmScrollerContainer"]'),
                    document.querySelector('[data-testid="DMCompositeMessage"]'),
                    document.querySelector('[data-testid="messageEntry"]')?.closest('[role="dialog"]'),
                    document.querySelector('[data-testid="cellInnerDiv"]')?.closest('[class*="r-"]'),
                    // Fallback: look for any area with message entries
                    document.querySelector('[data-testid="messageEntry"]')?.parentElement?.parentElement?.parentElement,
                    // New UI selectors (Tailwind-based)
                    document.querySelector('li[style*="position: absolute"]'),
                    document.querySelector('[data-testid*="message-text"]'),
                    document.querySelector('.font-chirp'),
                    // Any visible dialog/drawer
                    document.querySelector('[role="dialog"]'),
                    document.querySelector('[class*="drawer"]'),
                    document.querySelector('[class*="modal"]')
                ].filter(Boolean)[0];

                // Also check if we can find any URLs on the page (either UI)
                const hasContent = containers ||
                    document.querySelector('[data-testid*="message"]') ||
                    document.body.textContent.match(/https?:\/\/[^\s]+/);

                console.log(`XSpamSweeper: Attempt ${attempts}/${maxAttempts}, container: ${!!containers}, hasContent: ${!!hasContent}`);

                if (hasContent || attempts >= maxAttempts) {
                    clearInterval(checkForMessages);

                    const links = [];
                    const searchArea = document.body; // Search entire body for robustness

                    // Look for link cards (link previews with thumbnails) - OLD UI
                    const cardLinks = searchArea.querySelectorAll('[data-testid="card.wrapper"] a[href]');
                    console.log(`XSpamSweeper: Found ${cardLinks.length} card links`);
                    cardLinks.forEach(a => {
                        const href = a.href;
                        if (href && !href.includes('x.com') && !href.includes('twitter.com')) {
                            links.push(href);
                        }
                        // OLD UI: Extract domain from card description text (e.g., "onlyfans.com")
                        const cardDetail = a.querySelector('[data-testid="card.layoutSmall.detail"]');
                        if (cardDetail) {
                            const domainText = cardDetail.querySelector('div[dir="auto"]')?.textContent?.trim();
                            if (domainText && domainText.match(/^[a-z0-9.-]+\.[a-z]{2,}$/i)) {
                                const domainUrl = 'https://' + domainText;
                                if (!links.includes(domainUrl)) {
                                    links.push(domainUrl);
                                    console.log(`XSpamSweeper: Extracted domain from card: ${domainUrl}`);
                                }
                            }
                        }
                    });

                    // Look for any external links in message entries - OLD UI
                    const messageEntries = searchArea.querySelectorAll('[data-testid="messageEntry"]');
                    console.log(`XSpamSweeper: Found ${messageEntries.length} message entries (old UI)`);
                    messageEntries.forEach(entry => {
                        const entryLinks = entry.querySelectorAll('a[href]');
                        entryLinks.forEach(a => {
                            const href = a.href;
                            if (href &&
                                !href.includes('x.com') &&
                                !href.includes('twitter.com') &&
                                !href.startsWith('javascript:') &&
                                !links.includes(href)) {
                                links.push(href);
                            }
                        });
                    });

                    // Check for t.co links (Twitter's shortener) anywhere
                    const tcoLinks = document.querySelectorAll('a[href*="t.co"]');
                    console.log(`XSpamSweeper: Found ${tcoLinks.length} t.co links`);
                    tcoLinks.forEach(a => {
                        if (!links.includes(a.href)) {
                            links.push(a.href);
                        }
                    });

                    // NEW UI: Extract URLs from .font-chirp elements (Tailwind-based UI)
                    const fontChirpElements = searchArea.querySelectorAll('.font-chirp');
                    console.log(`XSpamSweeper: Found ${fontChirpElements.length} font-chirp elements`);
                    fontChirpElements.forEach(el => {
                        const text = el.textContent?.trim() || '';
                        if (text.match(/^https?:\/\//i)) {
                            if (!text.includes('x.com') && !text.includes('twitter.com') && !links.includes(text)) {
                                links.push(text);
                                console.log(`XSpamSweeper: Extracted URL from font-chirp: ${text}`);
                            }
                        }
                    });

                    // NEW UI: Extract URLs from plain text (Tailwind-based UI shows URLs as text)
                    const urlRegex = /https?:\/\/[^\s<>"']+/gi;
                    const pageText = searchArea.textContent || '';
                    const textUrls = pageText.match(urlRegex) || [];
                    console.log(`XSpamSweeper: Found ${textUrls.length} URLs in page text`);
                    textUrls.forEach(url => {
                        // Filter out X/Twitter URLs
                        if (!url.includes('x.com') &&
                            !url.includes('twitter.com') &&
                            !links.includes(url)) {
                            links.push(url);
                        }
                    });

                    // Also look for ALL anchor tags with external hrefs
                    const allLinks = document.querySelectorAll('a[href]');
                    console.log(`XSpamSweeper: Checking ${allLinks.length} total links on page`);
                    allLinks.forEach(a => {
                        const href = a.href;
                        if (href &&
                            !href.includes('x.com') &&
                            !href.includes('twitter.com') &&
                            !href.startsWith('javascript:') &&
                            !href.startsWith('about:') &&
                            !links.includes(href)) {
                            links.push(href);
                        }
                    });

                    console.log(`XSpamSweeper: Total ${links.length} unique links extracted after ${attempts} attempts`);

                    resolve({
                        links: [...new Set(links)],
                        messageCount: messageEntries.length || document.querySelectorAll('li[style*="position"]').length,
                        containerFound: !!containers,
                        attempts
                    });
                }
            }, 500);
        } // End of continueWithMessageButton
    }); // End of Promise
}
