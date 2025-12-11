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
 * Shared utility functions for X Spam Sweeper
 * These functions are used across multiple scripts (content.js, popup.js)
 */

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML string
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

/**
 * Native click helper for React compatibility
 * Regular .click() is sometimes ignored by React components, so we simulate full event sequence
 * @param {Element} element - Element to click
 * @returns {boolean} True if click was dispatched
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
            composed: true // Important for Shadow DOM boundaries if present
        });
        element.dispatchEvent(event);
    });
    return true;
}

/**
 * Small delay utility
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Find and click an interactive element containing specific text
 * Traverses up from text matches to find clickable parents
 * @param {string} text - Text to match
 * @param {Array<string>} [tags=['BUTTON', 'A', 'INPUT', 'DIV']] - Interactive tags to look for
 * @returns {boolean} True if clicked
 */
function clickElementWithText(text, tags = ['BUTTON', 'A', 'INPUT', 'DIV']) {
    // Normalize quotes in search text (handle smart quotes)
    const lowerText = text.toLowerCase().replace(/[\u2018\u2019]/g, "'");

    // Strategy: Find all elements containing the text
    const allElements = document.querySelectorAll('*');
    let candidates = [];

    for (const el of allElements) {
        // Check finding direct text content or very close to it
        // Normalize element content too
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

    // SORT CANDIDATES to prioritize Buttons/Links over generic text
    candidates.sort((a, b) => {
        // Helper to score an element chain
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
        return getScore(b) - getScore(a); // High score first
    });

    let anyClicked = false;

    for (const candidate of candidates) {
        console.log(`XSpamSweeper: Attacking candidate <${candidate.tagName}> for "${text}"`);

        // AGGRESSIVE STRATEGY: Click the element and ALL its parents up to a certain level.

        let current = candidate;
        let clickedInChain = 0;

        // 1. Click the text node container itself first
        nativeClick(current);

        // 2. Traverse up and click parents
        for (let i = 0; i < 7; i++) {
            if (!current.parentElement) break;
            current = current.parentElement;

            // Skip clicking obviously huge containers like BODY/HTML
            if (current.tagName === 'BODY' || current.tagName === 'HTML' || current.tagName === 'IFRAME') break;

            // Visual debug for what we are clicking
            current.style.border = "2px solid orange";

            nativeClick(current);
            clickedInChain++;
        }

        if (clickedInChain > 0) anyClicked = true;

        // If we have multiple candidates (e.g. description text AND actual button),
        // we must ensure we hit the button even if we hit the description first.
    }

    return anyClicked;
}

/**
 * Click submit/next/report buttons in the report flow
 * @param {number} maxAttempts - Maximum attempts to find buttons
 * @returns {Promise<boolean>}
 */
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

        if (!clicked) {
            console.log(`XSpamSweeper: No submit button found on attempt ${attempt + 1}`);
        }
    }
    return false;
}

/**
 * Utility: Wait for an element to appear
 * @param {string} selector - CSS selector
 * @param {number} timeout - Timeout in ms
 * @returns {Promise<Element|null>}
 */
function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve) => {
        const element = document.querySelector(selector);
        if (element) {
            resolve(element);
            return;
        }

        const observer = new MutationObserver(() => {
            const el = document.querySelector(selector);
            if (el) {
                observer.disconnect();
                resolve(el);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        setTimeout(() => {
            observer.disconnect();
            resolve(null);
        }, timeout);
    });
}

/**
 * Utility: Wait for element to disappear
 * @param {string} selector - CSS selector
 * @param {number} timeout - Timeout in ms
 * @returns {Promise<boolean>}
 */
function waitForElementToDisappear(selector, timeout = 5000) {
    return new Promise((resolve) => {
        const check = () => !document.querySelector(selector);
        if (check()) {
            resolve(true);
            return;
        }

        const observer = new MutationObserver(() => {
            if (check()) {
                observer.disconnect();
                resolve(true);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        setTimeout(() => {
            observer.disconnect();
            resolve(check());
        }, timeout);
    });
}

/**
 * Extract text content from an element, including emojis from img alt attributes
 * X renders emojis as <img> tags with the Unicode emoji in the alt attribute
 * @param {Element} element - The element to extract text from
 * @returns {string} Text with emojis preserved
 */
function extractTextWithEmojis(element) {
    if (!element) return '';

    let result = '';

    const walk = (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            result += node.textContent;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === 'IMG' && node.alt) {
                result += node.alt;
            } else {
                for (const child of node.childNodes) {
                    walk(child);
                }
            }
        }
    };

    walk(element);
    return result.trim();
}
