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
 * This function is injected into all frames to handle report automation
 * It runs in the context of the page, not the extension
 */
function handleReportIframeAutomation() {
    // Only run in the report iframe
    if (!window.location.href.includes('/i/safety/report_story')) {
        return;
    }

    console.log('XSpamSweeper: Report handler running in iframe');

    function nativeClick(element) {
        if (!element) return false;

        // Dispatch sequence: mousedown -> mouseup -> click
        ['mousedown', 'mouseup', 'click'].forEach(eventType => {
            const event = new MouseEvent(eventType, {
                view: window,
                bubbles: true,
                cancelable: true,
                buttons: 1
            });
            element.dispatchEvent(event);
        });
        return true;
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
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

    // Click submit/next/report buttons
    async function clickSubmitButtons() {
        for (let attempt = 0; attempt < 5; attempt++) {
            await delay(600);

            const buttons = document.querySelectorAll('button, div[role="button"]');
            for (const btn of buttons) {
                const text = (btn.textContent || '').trim();
                if (text === 'Submit' || text === 'Report' || text === 'Next') {
                    console.log(`XSpamSweeper: Clicking "${text}" button`);
                    nativeClick(btn);
                    await delay(700);
                    // Continue looking for more buttons (multi-step flow)
                }
            }
        }
    }

    automateSpamReport();
}
