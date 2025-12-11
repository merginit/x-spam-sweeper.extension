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
