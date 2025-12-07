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

// Wrap in IIFE to prevent redeclaration errors when injected multiple times
(function () {
    'use strict';

    // Guard against double injection
    if (window.__xSpamSweeperLoaded) {
        return;
    }
    window.__xSpamSweeperLoaded = true;

    /**
     * Native click helper for React compatibility
     * Regular .click() is sometimes ignored by React components
     */
    function nativeClick(element) {
        if (!element) return false;
        const event = new MouseEvent('click', {
            view: window,
            bubbles: true,
            cancelable: true
        });
        element.dispatchEvent(event);
        return true;
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

    /**
     * Extract message request data from the current page
     * Uses stable data-testid selectors that are unlikely to change
     * @returns {Array<Object>} Array of message request objects
     */
    function extractMessageRequests() {
        const requests = [];

        // Each message row is wrapped in cellInnerDiv (virtualized list)
        const cells = document.querySelectorAll('div[data-testid="cellInnerDiv"]');

        cells.forEach((cell) => {
            try {
                // Check if this cell contains a conversation
                const conversation = cell.querySelector('[data-testid="conversation"]');
                if (!conversation) return;

                // Get username from avatar link href (most reliable)
                const avatarLink = cell.querySelector('a[data-testid="DM_Conversation_Avatar"]');
                const href = avatarLink?.getAttribute('href');
                if (!href) return;

                const username = href.replace('/', '');

                // Get avatar image URL
                const avatarImg = cell.querySelector('[data-testid="DM_Conversation_Avatar"] img');
                const avatarUrl = avatarImg?.src || '';

                // Get message preview text (with emojis)
                const messageElement = cell.querySelector('[data-testid="tweetText"]');
                let messagePreview = '';
                if (messageElement) {
                    const fullText = extractTextWithEmojis(messageElement);
                    messagePreview = fullText.substring(0, 150);
                    if (fullText.length > 150) {
                        messagePreview += '...';
                    }
                }

                // Get timestamp
                const timeElement = cell.querySelector('time');
                const dateStr = timeElement?.textContent || '';
                const dateIso = timeElement?.getAttribute('datetime') || '';

                // Get display name with emojis
                // Find the name element - it's typically the first bold text in the conversation header
                // We look for the name span which contains the display name
                let displayName = username;

                // The name is in a container with specific styling, find it by structure
                // It's the first text element that isn't the @username
                const nameContainer = conversation.querySelector('[dir="ltr"][class*="r-b88u0q"]');
                if (nameContainer) {
                    displayName = extractTextWithEmojis(nameContainer);
                }

                // Fallback: if no name found, use the conversation text split
                if (!displayName || displayName === username) {
                    const firstTextDiv = conversation.querySelector('[dir="ltr"]');
                    if (firstTextDiv) {
                        displayName = extractTextWithEmojis(firstTextDiv);
                    }
                }

                requests.push({
                    username,
                    displayName: displayName || username,
                    avatarUrl,
                    messagePreview,
                    date: dateStr,
                    dateIso,
                    profileUrl: `https://x.com/${username}`
                });

            } catch (err) {
                console.error('XSpamSweeper: Error extracting conversation', err);
            }
        });

        return requests;
    }

    /**
     * Check if we're on the message requests page
     * @returns {boolean}
     */
    function isOnMessageRequestsPage() {
        return window.location.href.includes('/messages/requests');
    }

    /**
     * Check if we're inside the report iframe
     * @returns {boolean}
     */
    function isInReportIframe() {
        return window.location.href.includes('/i/safety/report_story');
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
     * Utility: Small delay
     * @param {number} ms - Milliseconds to wait
     * @returns {Promise<void>}
     */
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Find message row by username
     * @param {string} username - The username to find
     * @returns {Element|null}
     */
    function findRowByUsername(username) {
        const cells = document.querySelectorAll('div[data-testid="cellInnerDiv"]');
        for (const cell of cells) {
            const avatarLink = cell.querySelector('a[data-testid="DM_Conversation_Avatar"]');
            const href = avatarLink?.getAttribute('href');
            if (href && href.replace('/', '') === username) {
                return cell;
            }
        }
        return null;
    }

    /**
     * Click the options menu button on a row
     * @param {Element} row - The message row element
     * @returns {Promise<boolean>}
     */
    async function clickOptionsMenu(row) {
        const optionsBtn = row.querySelector('button[aria-label="Options menu"]');
        if (!optionsBtn) {
            console.error('XSpamSweeper: Options button not found');
            return false;
        }
        nativeClick(optionsBtn);
        await delay(300);
        return true;
    }

    /**
     * Wait for the HoverCard menu to appear
     * @returns {Promise<Element|null>}
     */
    async function waitForHoverCard() {
        return await waitForElement('[data-testid="HoverCard"]', 3000);
    }

    /**
     * Click a menu action from the HoverCard
     * @param {string} actionText - Text to match (Delete, Block, Report)
     * @returns {Promise<boolean>}
     */
    async function clickMenuAction(actionText) {
        const hoverCard = await waitForHoverCard();
        if (!hoverCard) {
            console.error('XSpamSweeper: HoverCard not found');
            return false;
        }

        const menuItems = hoverCard.querySelectorAll('div[role="menuitem"]');
        for (const item of menuItems) {
            if (item.textContent.includes(actionText)) {
                nativeClick(item);
                await delay(300);
                return true;
            }
        }

        console.error(`XSpamSweeper: Menu action "${actionText}" not found`);
        return false;
    }

    /**
     * Handle confirmation dialog if it appears
     * @returns {Promise<boolean>}
     */
    async function handleConfirmation() {
        await delay(500);
        const confirmBtn = document.querySelector('[data-testid="confirmationSheetConfirm"]');
        if (confirmBtn) {
            nativeClick(confirmBtn);
            await delay(500);
            return true;
        }
        return false;
    }

    /**
     * Close any open HoverCard menu
     */
    async function closeHoverCard() {
        const hoverCard = document.querySelector('[data-testid="HoverCard"]');
        if (hoverCard) {
            // Click elsewhere to close
            document.body.click();
            await delay(200);
        }
    }

    /**
     * Perform an action on a user
     * @param {string} username - The username
     * @param {'delete'|'block'|'report'} action - The action type
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async function performAction(username, action) {
        try {
            // Close any existing menu first
            await closeHoverCard();

            // Find the row
            const row = findRowByUsername(username);
            if (!row) {
                return { success: false, message: `User @${username} not found in list` };
            }

            // Click options menu
            if (!await clickOptionsMenu(row)) {
                return { success: false, message: `Could not open options menu for @${username}` };
            }

            // Map action to menu text
            const actionTextMap = {
                'delete': 'Delete conversation',
                'block': 'Block',
                'report': 'Report'
            };

            const actionText = actionTextMap[action];
            if (!actionText) {
                return { success: false, message: `Unknown action: ${action}` };
            }

            // Click the menu action
            if (!await clickMenuAction(actionText)) {
                await closeHoverCard();
                return { success: false, message: `Could not find ${action} option for @${username}` };
            }

            // Handle confirmation for delete (block doesn't need it)
            if (action === 'delete') {
                await handleConfirmation();
            }

            // For report, wait for iframe automation and then click Done button in parent
            if (action === 'report') {
                // Wait for iframe content script to handle the spam selection and submit
                await delay(6000);

                // Now look for Done button in the parent modal
                for (let i = 0; i < 5; i++) {
                    const buttons = document.querySelectorAll('button');
                    for (const btn of buttons) {
                        const text = (btn.textContent || '').trim();
                        if (text === 'Done') {
                            console.log('XSpamSweeper: Clicking Done button');
                            nativeClick(btn);
                            await delay(500);
                            return { success: true, message: `report completed for @${username}` };
                        }
                    }
                    await delay(500);
                }
            }

            return { success: true, message: `${action} completed for @${username}` };

        } catch (error) {
            console.error(`XSpamSweeper: Error performing ${action} on @${username}`, error);
            return { success: false, message: `Error: ${error.message}` };
        }
    }

    /**
     * Handle report iframe - click Spam option
     * This runs inside the report iframe when all_frames is true
     */
    async function handleReportSpam() {
        if (!isInReportIframe()) return;

        await delay(500);

        // Look for Spam option using XPath for text matching
        const spans = document.querySelectorAll('span');
        for (const span of spans) {
            if (span.textContent.trim() === 'Spam') {
                nativeClick(span);
                await delay(500);

                // Click Next/Submit button
                const nextBtns = document.querySelectorAll('button');
                for (const btn of nextBtns) {
                    if (btn.textContent.includes('Next') || btn.textContent.includes('Submit')) {
                        nativeClick(btn);
                        break;
                    }
                }
                break;
            }
        }
    }

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        // Handle iframe report automation
        if (isInReportIframe()) {
            if (request.action === 'handleReportSpam') {
                handleReportSpam().then(() => {
                    sendResponse({ success: true });
                });
                return true;
            }
            return false;
        }

        // Main page handlers
        if (request.action === 'getMessageRequests') {
            if (!isOnMessageRequestsPage()) {
                sendResponse({
                    success: false,
                    error: 'not_on_requests_page',
                    message: 'Please navigate to x.com/messages/requests'
                });
                return true;
            }

            const requests = extractMessageRequests();
            sendResponse({
                success: true,
                data: requests,
                count: requests.length
            });
            return true;
        }

        if (request.action === 'ping') {
            sendResponse({ success: true, onRequestsPage: isOnMessageRequestsPage() });
            return true;
        }

        // Action handlers
        if (request.action === 'deleteConversation') {
            performAction(request.username, 'delete').then(sendResponse);
            return true;
        }

        if (request.action === 'blockUser') {
            performAction(request.username, 'block').then(sendResponse);
            return true;
        }

        if (request.action === 'reportUser') {
            performAction(request.username, 'report').then(sendResponse);
            return true;
        }

        if (request.action === 'sweepUser') {
            // Sweep = Report + Block + Delete (in that order)
            (async () => {
                const results = [];

                // 1. Report first
                const reportResult = await performAction(request.username, 'report');
                results.push({ action: 'report', ...reportResult });
                await delay(1500); // Wait for report dialog

                // 2. Then Block
                const blockResult = await performAction(request.username, 'block');
                results.push({ action: 'block', ...blockResult });
                await delay(500);

                // 3. Finally Delete
                const deleteResult = await performAction(request.username, 'delete');
                results.push({ action: 'delete', ...deleteResult });

                const allSuccess = results.every(r => r.success);
                sendResponse({
                    success: allSuccess,
                    message: allSuccess ? `Swept @${request.username}` : `Partial sweep for @${request.username}`,
                    details: results
                });
            })();
            return true;
        }
    });

    // If we're in the report iframe, auto-handle spam selection with retry
    if (isInReportIframe()) {
        console.log('XSpamSweeper: In report iframe, will auto-select Spam');

        // Click any submit/report/next buttons that appear
        async function clickSubmitButtons(maxAttempts = 6) {
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                await delay(700);

                const buttons = document.querySelectorAll('button');
                let clicked = false;

                for (const btn of buttons) {
                    const text = (btn.textContent || '').trim();
                    // Look for Submit, Report, Next, or Done buttons
                    if (text === 'Submit' || text === 'Report' || text === 'Next' || text.includes('Submit')) {
                        console.log(`XSpamSweeper: Clicking "${text}" button`);
                        nativeClick(btn);
                        clicked = true;
                        await delay(800);
                        break;
                    }
                }

                if (!clicked) {
                    console.log(`XSpamSweeper: No submit button found on attempt ${attempt + 1}`);
                }
            }
        }

        // Function to attempt spam selection with retries
        async function attemptSpamSelection(retries = 8) {
            for (let i = 0; i < retries; i++) {
                await delay(600);

                // Look for Spam option
                const spans = document.querySelectorAll('span');
                for (const span of spans) {
                    if (span.textContent.trim() === 'Spam') {
                        console.log('XSpamSweeper: Found Spam option, clicking...');
                        nativeClick(span);

                        // Wait and then click submit buttons
                        await delay(800);
                        await clickSubmitButtons();
                        return true;
                    }
                }
                console.log(`XSpamSweeper: Spam option not found, retry ${i + 1}/${retries}`);
            }
            console.log('XSpamSweeper: Could not find Spam option after retries');
            return false;
        }

        // Wait for DOM to be ready then attempt
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => attemptSpamSelection());
        } else {
            attemptSpamSelection();
        }
    }

    console.log('XSpamSweeper: Content script loaded' + (isInReportIframe() ? ' (in report iframe)' : ''));
})(); // End IIFE
