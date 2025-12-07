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

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
});

console.log('XSpamSweeper: Content script loaded');
