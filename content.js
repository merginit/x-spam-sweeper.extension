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

    // Fallback for shared.js functions if not loaded
    const _extractTextWithEmojis = typeof extractTextWithEmojis === 'function'
        ? extractTextWithEmojis
        : (el) => el?.textContent?.trim() || '';

    const _getSpamInfo = typeof getSpamInfo === 'function'
        ? getSpamInfo
        : () => ({ riskLevel: 'safe', score: 0, isHiddenLink: false });

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
                // First try the standard tweetText element
                let messageElement = cell.querySelector('[data-testid="tweetText"]');
                let messagePreview = '';
                if (messageElement) {
                    const fullText = _extractTextWithEmojis(messageElement);
                    messagePreview = fullText.substring(0, 150);
                    if (fullText.length > 150) {
                        messagePreview += '...';
                    }
                } else {
                    // Fallback: look for media indicators like "Sent a photo", "Sent a video", etc.
                    const spans = cell.querySelectorAll('span');
                    for (const span of spans) {
                        const spanText = span.textContent.trim();
                        if (spanText.match(/^Sent (a |an )?(photo|video|GIF|voice message|sticker|link)/i) ||
                            spanText.match(/^(Photo|Video|GIF|Voice message|Sticker)$/i) ||
                            spanText.match(/^Shared a (post|link|message)/i) ||
                            spanText.match(/^Liked a message$/i) ||
                            spanText.match(/^Reacted /i)) {
                            messagePreview = spanText;
                            break;
                        }
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
                    displayName = _extractTextWithEmojis(nameContainer);
                }

                // Fallback: if no name found, use the conversation text split
                if (!displayName || displayName === username) {
                    const firstTextDiv = conversation.querySelector('[dir="ltr"]');
                    if (firstTextDiv) {
                        displayName = _extractTextWithEmojis(firstTextDiv);
                    }
                }

                const spamInfo = _getSpamInfo(messagePreview);

                requests.push({
                    username,
                    displayName: displayName || username,
                    avatarUrl,
                    messagePreview,
                    date: dateStr,
                    dateIso,
                    profileUrl: `https://x.com/${username}`,
                    spamInfo
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
     * Check if a user's conversation row still exists in the list
     * @param {string} username - The username to check
     * @returns {boolean}
     */
    function isConversationStillVisible(username) {
        return findRowByUsername(username) !== null;
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
     * @param {boolean} skipIfGone - If true, return success if user row is already gone
     * @returns {Promise<{success: boolean, message: string, alreadyGone?: boolean}>}
     */
    async function performAction(username, action, skipIfGone = false) {
        try {
            // Close any existing menu first
            await closeHoverCard();

            // Find the row
            const row = findRowByUsername(username);
            if (!row) {
                // If skipIfGone is true, treat missing row as success (already dealt with)
                if (skipIfGone) {
                    console.log(`XSpamSweeper: User @${username} already gone from list, skipping ${action}`);
                    return { success: true, message: `@${username} already removed`, alreadyGone: true };
                }
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

            // For delete, wait a bit for the action to complete
            if (action === 'delete') {
                await delay(500);
                // Verify the row is now gone
                if (!isConversationStillVisible(username)) {
                    console.log(`XSpamSweeper: Delete successful - @${username} removed from list`);
                    return { success: true, message: `delete completed for @${username}` };
                }
            }

            // For report, trigger programmatic iframe injection and wait for automation
            if (action === 'report') {
                // Wait for report dialog iframe to appear
                console.log('XSpamSweeper: Waiting for report iframe to appear...');
                const iframe = await waitForElement('iframe[src*="report_story"]', 8000);

                if (iframe) {
                    console.log('XSpamSweeper: Iframe found, waiting 1s for load...');
                    await delay(1000);

                    try {
                        sessionStorage.setItem('xSpamSweeperAutoReport', 'true');
                    } catch (e) {
                        console.log('XSpamSweeper: Could not set sessionStorage flag');
                    }

                    // Tell background script to inject automation code into all frames
                    console.log('XSpamSweeper: Requesting background script to inject into iframe');
                    try {
                        chrome.runtime.sendMessage({ action: 'injectReportHandler' });
                    } catch (e) {
                        console.error('XSpamSweeper: Failed to send injection request', e);
                    }
                } else {
                    console.error('XSpamSweeper: Report iframe did not appear');
                    await closeHoverCard();
                    return { success: false, message: `Report iframe missing for @${username}` };
                }

                // Wait for iframe automation to complete
                await delay(6000);

                // Look for completion buttons: "Done", "Block @username", or "Mute @username"
                // These indicate the report flow has finished
                for (let i = 0; i < 8; i++) {
                    const buttons = document.querySelectorAll('button');
                    for (const btn of buttons) {
                        const text = (btn.textContent || '').trim();
                        if (text === 'Done' || text.startsWith('Block @') || text.startsWith('Mute @')) {
                            console.log(`XSpamSweeper: Clicking "${text}" button to complete report`);
                            nativeClick(btn);
                            await delay(500);
                            return { success: true, message: `report completed for @${username}` };
                        }
                    }
                    await delay(500);

                    // Also check if the conversation disappeared (if X auto-removed it)
                    if (!isConversationStillVisible(username)) {
                        console.log(`XSpamSweeper: Conversation @${username} was auto-removed after report`);
                        // Try to close any remaining modal
                        document.body.click();
                        await delay(300);
                        return { success: true, message: `report completed for @${username} (auto-removed)` };
                    }
                }

                // If we get here but the conversation is gone, still consider it success
                if (!isConversationStillVisible(username)) {
                    return { success: true, message: `report completed for @${username}` };
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

        // Try specific text first "It's spam"
        if (clickElementWithText("It's spam")) {
            await delay(500);
            return clickSubmitButtons();
        }

        // Fallback to searching spans if the robust helper failed (though helper covers it)
        console.log('XSpamSweeper: "It\'s spam" text not found, trying loose search');
        const spans = document.querySelectorAll('span');
        for (const span of spans) {
            const spanText = span.textContent.trim().toLowerCase();
            if (spanText.includes('spam') && !spanText.includes('learn')) {
                nativeClick(span);
                await delay(500);
                return clickSubmitButtons();
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
            // Smart handling: if conversation disappears after report, skip remaining steps
            (async () => {
                const results = [];

                // 1. Report first
                const reportResult = await performAction(request.username, 'report');
                results.push({ action: 'report', ...reportResult });

                // Check if conversation is already gone after report
                // (X sometimes auto-removes when you select Block and Mute)
                if (!isConversationStillVisible(request.username)) {
                    console.log(`XSpamSweeper: @${request.username} already gone after report, sweep complete`);
                    results.push({ action: 'block', success: true, message: 'skipped - already removed' });
                    results.push({ action: 'delete', success: true, message: 'skipped - already removed' });
                    sendResponse({
                        success: true,
                        message: `Swept @${request.username}`,
                        details: results
                    });
                    return;
                }

                await delay(1000);

                // 2. Then Block (with skipIfGone=true since report might have removed it)
                const blockResult = await performAction(request.username, 'block', true);
                results.push({ action: 'block', ...blockResult });

                // Check again if gone after block
                if (!isConversationStillVisible(request.username)) {
                    console.log(`XSpamSweeper: @${request.username} gone after block, sweep complete`);
                    results.push({ action: 'delete', success: true, message: 'skipped - already removed' });
                    sendResponse({
                        success: true,
                        message: `Swept @${request.username}`,
                        details: results
                    });
                    return;
                }

                await delay(500);

                // 3. Finally Delete (with skipIfGone=true)
                const deleteResult = await performAction(request.username, 'delete', true);
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

    // If we're in the report iframe AND the extension triggered it, auto-handle spam selection
    if (isInReportIframe()) {
        // Check if this was triggered by the extension (not a manual user report)
        let isExtensionTriggered = false;
        try {
            isExtensionTriggered = sessionStorage.getItem('xSpamSweeperAutoReport') === 'true';
            // Clear the flag immediately so it doesn't persist
            sessionStorage.removeItem('xSpamSweeperAutoReport');
        } catch (e) {
            console.log('XSpamSweeper: Could not read sessionStorage flag');
        }

        if (isExtensionTriggered) {
            console.log('XSpamSweeper: In report iframe (extension-triggered), will auto-select Spam');

            async function attemptSpamSelection(retries = 20) {
                console.log("XSpamSweeper: Iframe text content available:", document.body.innerText.substring(0, 100) + "...");

                for (let i = 0; i < retries; i++) {
                    await delay(1000);

                    // 1. Try finding "It's spam"
                    if (clickElementWithText("It's spam")) {
                        console.log('XSpamSweeper: Clicked "It\'s spam"');
                        await delay(800);
                        await clickSubmitButtons();
                        return true;
                    }

                    // 2. ALSO check for Next/Submit buttons directly
                    if (await clickSubmitButtons(1)) {
                        console.log('XSpamSweeper: Clicked a submit button in catch-up mode');
                        return true;
                    }

                    console.log(`XSpamSweeper: "It's spam" option not found, retry ${i + 1}/${retries}`);

                    // Fallback: try finding just "spam" after some retries
                    if (i > 5) {
                        if (clickElementWithText("spam")) {
                            console.log('XSpamSweeper: Clicked "spam" (loose match)');
                            await delay(800);
                            await clickSubmitButtons();
                            return true;
                        }
                    }
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
        } else {
            console.log('XSpamSweeper: In report iframe (manual), NOT auto-selecting');
        }
    }

    console.log('XSpamSweeper: Content script loaded' + (isInReportIframe() ? ' (in report iframe)' : ''));
})();
