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

// State
let messageRequests = [];
let selectedUsernames = new Set();
let isFilterActive = false;

// DOM Elements
const requestsList = document.getElementById('requestsList');
const loadingState = document.getElementById('loadingState');
const emptyState = document.getElementById('emptyState');
const errorState = document.getElementById('errorState');
const errorMessage = document.getElementById('errorMessage');
const actionBar = document.getElementById('actionBar');
const selectAllCheckbox = document.getElementById('selectAll');
const selectionCount = document.getElementById('selectionCount');
const reportBtn = document.getElementById('reportBtn');
const blockBtn = document.getElementById('blockBtn');
const sweepBtn = document.getElementById('sweepBtn');
const menuBtn = document.getElementById('menuBtn');
const deleteBtn = document.getElementById('deleteBtn');
const submenu = document.getElementById('submenu');
const refreshBtn = document.getElementById('refreshBtn');
const resolveLinksBtn = document.getElementById('resolveLinksBtn');
const filterToggleBtn = document.getElementById('filterToggleBtn');
const goToRequestsBtn = document.getElementById('goToRequestsBtn');
const statusBar = document.getElementById('status');

/**
 * Show a specific state and hide others
 */
function showState(state) {
    loadingState.classList.add('hidden');
    emptyState.classList.add('hidden');
    errorState.classList.add('hidden');
    requestsList.classList.add('hidden');
    actionBar.classList.add('hidden');

    switch (state) {
        case 'loading':
            loadingState.classList.remove('hidden');
            break;
        case 'empty':
            emptyState.classList.remove('hidden');
            break;
        case 'error':
            errorState.classList.remove('hidden');
            break;
        case 'list':
            requestsList.classList.remove('hidden');
            actionBar.classList.remove('hidden');
            break;
    }
}

/**
 * Update selection count and button states
 */
function updateSelectionUI() {
    const count = selectedUsernames.size;
    selectionCount.textContent = `${count} selected`;

    const hasSelection = count > 0;
    reportBtn.disabled = !hasSelection;
    blockBtn.disabled = !hasSelection;
    sweepBtn.disabled = !hasSelection;
    menuBtn.disabled = !hasSelection;

    // Get visible requests based on filter state (must match renderRequestsList filter)
    const visibleRequests = isFilterActive
        ? messageRequests.filter(req => {
            const riskLevel = req.spamInfo?.riskLevel || 'safe';
            return riskLevel === 'high' || riskLevel === 'medium';
        })
        : messageRequests;

    const visibleSelectedCount = visibleRequests.filter(req =>
        selectedUsernames.has(req.username)
    ).length;

    // Update select all checkbox state based on visible items
    if (visibleSelectedCount === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
    } else if (visibleSelectedCount === visibleRequests.length) {
        selectAllCheckbox.checked = true;
        selectAllCheckbox.indeterminate = false;
    } else {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = true;
    }
}

/**
 * Toggle selection for a username
 */
function toggleSelection(username) {
    if (selectedUsernames.has(username)) {
        selectedUsernames.delete(username);
    } else {
        selectedUsernames.add(username);
    }
    updateSelectionUI();
    updateRequestItemUI(username);
}

/**
 * Update the UI for a specific request item
 */
function updateRequestItemUI(username) {
    const item = document.querySelector(`[data-username="${username}"]`);
    if (item) {
        const checkbox = item.querySelector('input[type="checkbox"]');
        const isSelected = selectedUsernames.has(username);
        checkbox.checked = isSelected;
        item.classList.toggle('selected', isSelected);
    }
}

/**
 * Select or deselect all requests (respects current filter)
 */
function toggleSelectAll() {
    // Get only the visible requests based on filter state (must match renderRequestsList filter)
    const visibleRequests = isFilterActive
        ? messageRequests.filter(req => {
            const riskLevel = req.spamInfo?.riskLevel || 'safe';
            return riskLevel === 'high' || riskLevel === 'medium';
        })
        : messageRequests;

    const allVisibleSelected = visibleRequests.every(req => selectedUsernames.has(req.username));

    // Clear ALL selections first to avoid hidden items staying selected
    selectedUsernames.clear();

    if (!allVisibleSelected) {
        // Select all visible
        visibleRequests.forEach(req => selectedUsernames.add(req.username));
    }
    // If allVisibleSelected was true, we just clear (deselect all)

    updateSelectionUI();
    messageRequests.forEach(req => updateRequestItemUI(req.username));
}

/**
 * Create HTML for a request item
 */
function createRequestItem(request) {
    const isSelected = selectedUsernames.has(request.username);
    const spamInfo = request.spamInfo || { riskLevel: 'safe', score: 0, isHiddenLink: false };
    const riskLevel = spamInfo.riskLevel || 'safe';

    const item = document.createElement('div');
    item.className = `request-item spam-${riskLevel}${isSelected ? ' selected' : ''}`;
    item.dataset.username = request.username;

    // Create spam badge HTML based on risk level
    const maxScore = 30;
    let spamBadgeHtml = '';
    if (riskLevel === 'high') {
        spamBadgeHtml = `<span class="spam-badge high" title="High spam risk: ${spamInfo.score}/${maxScore}">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
          SPAM
        </span>`;
    } else if (riskLevel === 'medium') {
        spamBadgeHtml = `<span class="spam-badge medium" title="Medium risk: ${spamInfo.score}/${maxScore}">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
          SUS
        </span>`;
    } else if (riskLevel === 'low' && (spamInfo.score > 0 || spamInfo.isHiddenLink)) {
        const title = spamInfo.isHiddenLink ? 'Hidden link needs verification' : `Low risk: ${spamInfo.score}/${maxScore}`;
        spamBadgeHtml = `<span class="spam-badge low" title="${title}">?</span>`;
    }

    // Hidden link indicator
    let hiddenLinkHtml = '';
    if (spamInfo.isHiddenLink) {
        hiddenLinkHtml = `<span class="hidden-link-indicator" title="Link hidden - may need resolution">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>
          Hidden link
        </span>`;
    }

    item.innerHTML = `
    <div class="request-checkbox">
      <label class="checkbox-wrapper">
        <input type="checkbox" ${isSelected ? 'checked' : ''} />
        <span class="checkmark"></span>
      </label>
    </div>
    <img 
      class="request-avatar" 
      src="${escapeHtml(request.avatarUrl)}" 
      alt=""
      onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22%2371767b%22><circle cx=%2212%22 cy=%2212%22 r=%2210%22/></svg>'"
    />
    <div class="request-content">
      <div class="request-header">
        <span class="request-name">${escapeHtml(request.displayName)}</span>
        <span class="request-username">@${escapeHtml(request.username)}</span>
        ${spamBadgeHtml}
        <span class="request-date">${escapeHtml(request.date)}</span>
      </div>
      <div class="request-message"><span class="request-message-text">${escapeHtml(request.messagePreview)}</span>${hiddenLinkHtml}</div>
    </div>
  `;

    // Handle click on the item (but not directly on checkbox)
    item.addEventListener('click', (e) => {
        if (!e.target.closest('.checkbox-wrapper')) {
            toggleSelection(request.username);
        }
    });

    // Handle checkbox change
    const checkbox = item.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', () => {
        toggleSelection(request.username);
    });

    return item;
}

/**
 * Render the requests list
 */
function renderRequestsList() {
    requestsList.innerHTML = '';

    if (messageRequests.length === 0) {
        showState('empty');
        return;
    }

    // Filter requests based on filter toggle
    const requestsToShow = isFilterActive
        ? messageRequests.filter(req => {
            const riskLevel = req.spamInfo?.riskLevel || 'safe';
            return riskLevel === 'high' || riskLevel === 'medium';
        })
        : messageRequests;

    if (requestsToShow.length === 0) {
        // Show empty state with filter-specific message
        showState('empty');
        return;
    }

    requestsToShow.forEach(request => {
        requestsList.appendChild(createRequestItem(request));
    });

    showState('list');
    updateSelectionUI();
    updateFilterBadge();
}

/**
 * Inject content script into the tab
 */
async function injectContentScript(tabId) {
    try {
        await chrome.scripting.executeScript({
            target: { tabId },
            files: ['content.js']
        });
        return true;
    } catch (error) {
        console.error('XSpamSweeper: Failed to inject content script', error);
        return false;
    }
}

/**
 * Fetch message requests from the content script
 */
async function fetchMessageRequests() {
    showState('loading');
    selectedUsernames.clear();

    try {
        // Get the active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab) {
            showError('No active tab found');
            return;
        }

        // Check if we're on x.com
        if (!tab.url?.includes('x.com')) {
            showError('Please navigate to x.com/messages/requests', true);
            return;
        }

        let response;

        try {
            // Try to send message to content script
            response = await chrome.tabs.sendMessage(tab.id, { action: 'getMessageRequests' });
        } catch (error) {
            // Content script not loaded - inject it and retry
            if (error.message?.includes('Could not establish connection')) {
                const injected = await injectContentScript(tab.id);
                if (injected) {
                    // Wait a moment for the script to initialize
                    await new Promise(resolve => setTimeout(resolve, 100));
                    response = await chrome.tabs.sendMessage(tab.id, { action: 'getMessageRequests' });
                } else {
                    showError('Could not load extension on this page. Please refresh.');
                    return;
                }
            } else {
                throw error;
            }
        }

        if (!response) {
            showError('Could not connect to page. Please refresh and try again.');
            return;
        }

        if (!response.success) {
            if (response.error === 'not_on_requests_page') {
                showError('Please navigate to x.com/messages/requests', true);
            } else {
                showError(response.message || 'Failed to fetch message requests');
            }
            return;
        }

        messageRequests = response.data || [];

        // Enhance messages with resolved link data from storage
        try {
            const storage = await chrome.storage.local.get(['resolvedLinks']);
            const resolvedLinks = storage.resolvedLinks || {};

            messageRequests = messageRequests.map(req => {
                const resolved = resolvedLinks[req.username];
                if (resolved && resolved.links && resolved.links.length > 0) {
                    // We have resolved links for this user - reanalyze spam
                    const linksText = resolved.links.join(' ');
                    const updatedSpamInfo = typeof getSpamInfo === 'function'
                        ? getSpamInfo(linksText)
                        : req.spamInfo;

                    console.log(`XSpamSweeper: Re-analyzed @${req.username} with resolved links:`, {
                        links: resolved.links,
                        linksText,
                        updatedSpamInfo
                    });

                    // Update message preview to show actual URL(s) instead of "Sent a link"
                    let updatedMessagePreview = req.messagePreview;
                    if (/^sent a link$/i.test(req.messagePreview.trim())) {
                        // Format resolved links for display
                        const displayLinks = resolved.links.map(link => {
                            try {
                                const url = new URL(link);
                                return url.hostname + (url.pathname !== '/' ? url.pathname : '');
                            } catch {
                                return link;
                            }
                        });
                        updatedMessagePreview = displayLinks.slice(0, 2).join(', ');
                        if (resolved.links.length > 2) {
                            updatedMessagePreview += ` +${resolved.links.length - 2} more`;
                        }
                    }

                    return {
                        ...req,
                        messagePreview: updatedMessagePreview,
                        resolvedLinks: resolved.links,
                        spamInfo: {
                            ...updatedSpamInfo,
                            isHiddenLink: false,
                            resolvedAt: resolved.resolvedAt
                        }
                    };
                }
                return req;
            });
        } catch (e) {
            console.log('XSpamSweeper: Could not load resolved links', e);
        }

        renderRequestsList();

        if (messageRequests.length > 0) {
            setStatus(`Found ${messageRequests.length} message request${messageRequests.length !== 1 ? 's' : ''}`);
        }

    } catch (error) {
        console.error('XSpamSweeper: Error fetching requests', error);
        showError('Failed to fetch message requests. Please try again.');
    }
}

/**
 * Show error state
 */
function showError(message, showGoToButton = false) {
    errorMessage.textContent = message;
    goToRequestsBtn.classList.toggle('hidden', !showGoToButton);
    showState('error');
}

/**
 * Set status bar message
 */
function setStatus(message, type = '') {
    statusBar.textContent = message;
    statusBar.className = 'status' + (type ? ` ${type}` : '');

    // Auto-clear after 3 seconds
    setTimeout(() => {
        if (statusBar.textContent === message) {
            statusBar.textContent = '';
        }
    }, 3000);
}

/**
 * Navigate to message requests page
 */
async function goToMessageRequests() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
        await chrome.tabs.update(tab.id, { url: 'https://x.com/messages/requests' });
        window.close();
    }
}

// Event listeners
refreshBtn.addEventListener('click', fetchMessageRequests);
selectAllCheckbox.addEventListener('change', toggleSelectAll);
goToRequestsBtn.addEventListener('click', goToMessageRequests);

// Resolve hidden links button
resolveLinksBtn?.addEventListener('click', async () => {
    // Find all users with hidden links
    const hiddenLinkUsers = messageRequests
        .filter(req => req.spamInfo?.isHiddenLink)
        .map(req => req.username);

    if (hiddenLinkUsers.length === 0) {
        setStatus('No hidden links to resolve');
        return;
    }

    setStatus(`Resolving ${hiddenLinkUsers.length} hidden link(s)...`);

    try {
        const response = await chrome.runtime.sendMessage({
            action: 'resolveSentLinks',
            users: hiddenLinkUsers
        });

        if (response?.success) {
            setStatus(response.message, 'success');
        } else {
            setStatus(response?.message || 'Failed to start resolution', 'error');
        }
    } catch (error) {
        setStatus('Error starting link resolution', 'error');
        console.error('XSpamSweeper: Link resolution error:', error);
    }
});

// Toggle submenu visibility
function toggleSubmenu() {
    submenu.classList.toggle('hidden');
}

// Close submenu when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.menu-container')) {
        submenu.classList.add('hidden');
    }
});

// Menu button
menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleSubmenu();
});

/**
 * Perform batch action on selected users
 * @param {string} actionType - 'delete', 'block', 'report', or 'sweep'
 * @param {string} actionMessage - Message prefix for status
 */
async function performBatchAction(actionType, actionMessage) {
    const selected = Array.from(selectedUsernames);
    if (selected.length === 0) return;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
        setStatus('No active tab found', 'error');
        return;
    }

    // Disable buttons during processing
    sweepBtn.disabled = true;
    menuBtn.disabled = true;
    reportBtn.disabled = true;
    blockBtn.disabled = true;
    deleteBtn.disabled = true;

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < selected.length; i++) {
        const username = selected[i];
        setStatus(`${actionMessage} @${username} (${i + 1}/${selected.length})...`);

        try {
            const action = actionType === 'sweep' ? 'sweepUser' :
                actionType === 'delete' ? 'deleteConversation' :
                    actionType === 'block' ? 'blockUser' : 'reportUser';

            const response = await chrome.tabs.sendMessage(tab.id, {
                action: action,
                username: username
            });

            if (response?.success) {
                successCount++;
                // Remove from selection and list on success
                selectedUsernames.delete(username);
                const item = document.querySelector(`[data-username="${username}"]`);
                if (item && actionType === 'delete') {
                    item.remove();
                }
            } else {
                errorCount++;
                console.error(`Failed ${actionType} for @${username}:`, response?.message);
            }
        } catch (error) {
            errorCount++;
            console.error(`Error ${actionType} for @${username}:`, error);
        }

        // Small delay between actions to avoid rate limiting
        if (i < selected.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    // Re-enable buttons
    updateSelectionUI();

    // Show final status
    if (errorCount === 0) {
        setStatus(`${actionMessage} completed: ${successCount} accounts`, 'success');
    } else {
        setStatus(`${actionMessage}: ${successCount} succeeded, ${errorCount} failed`, 'error');
    }

    // Refresh list after sweep or delete to show updated state
    if (actionType === 'sweep' || actionType === 'delete') {
        await new Promise(resolve => setTimeout(resolve, 500));
        await fetchMessageRequests();
    }
}

// Sweep button - combined action (Report + Block + Delete)
sweepBtn.addEventListener('click', async () => {
    submenu.classList.add('hidden');
    await performBatchAction('sweep', 'Sweeping');
});

// Delete button
deleteBtn.addEventListener('click', async () => {
    submenu.classList.add('hidden');
    await performBatchAction('delete', 'Deleting');
});

// Block button
blockBtn.addEventListener('click', async () => {
    submenu.classList.add('hidden');
    await performBatchAction('block', 'Blocking');
});

// Report button
reportBtn.addEventListener('click', async () => {
    submenu.classList.add('hidden');
    await performBatchAction('report', 'Reporting');
});

/**
 * Toggle spam filter mode
 */
function toggleFilter() {
    isFilterActive = !isFilterActive;
    updateFilterUI();

    // Save preference to storage
    chrome.storage.local.set({ isFilterActive });

    // Re-render the list with new filter state
    renderRequestsList();

    const spamCount = messageRequests.filter(req => {
        const riskLevel = req.spamInfo?.riskLevel || 'safe';
        return riskLevel === 'high' || riskLevel === 'medium';
    }).length;

    if (isFilterActive) {
        setStatus(`Showing ${spamCount} suspicious message${spamCount !== 1 ? 's' : ''}`);
    } else {
        setStatus(`Showing all ${messageRequests.length} message${messageRequests.length !== 1 ? 's' : ''}`);
    }
}

/**
 * Update filter button UI based on state
 */
function updateFilterUI() {
    if (filterToggleBtn) {
        filterToggleBtn.classList.toggle('active', isFilterActive);
        filterToggleBtn.title = isFilterActive
            ? 'Toggle spam filter (showing spam only)'
            : 'Toggle spam filter (showing all)';
    }
    updateFilterBadge();
}

/**
 * Update the filter button badge with spam count
 */
function updateFilterBadge() {
    if (!filterToggleBtn) return;

    const spamCount = messageRequests.filter(req => {
        const riskLevel = req.spamInfo?.riskLevel || 'safe';
        return riskLevel === 'high' || riskLevel === 'medium';
    }).length;

    // Find or create the badge element
    let badge = filterToggleBtn.querySelector('.filter-badge');
    if (spamCount > 0) {
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'filter-badge';
            filterToggleBtn.appendChild(badge);
        }
        badge.textContent = spamCount > 99 ? '99+' : spamCount;
        badge.style.display = '';
    } else if (badge) {
        badge.style.display = 'none';
    }
}

/**
 * Load saved filter preference from storage
 */
async function loadFilterPreference() {
    try {
        const result = await chrome.storage.local.get(['isFilterActive']);
        isFilterActive = result.isFilterActive || false;
        updateFilterUI();
    } catch (e) {
        console.log('XSpamSweeper: Could not load filter preference');
    }
}

filterToggleBtn?.addEventListener('click', toggleFilter);

// Listen for DOM updates from content script (scrolling, navigation)
chrome.runtime.onMessage.addListener((request, _sender, _sendResponse) => {
    if (request.action === 'domUpdated') {
        console.log('XSpamSweeper Popup: DOM updated, refreshing list');
        if (!window._refreshPending) {
            window._refreshPending = true;
            setTimeout(async () => {
                await fetchMessageRequests();
                window._refreshPending = false;
            }, 500);
        }
    }

    if (request.action === 'linkResolved') {
        console.log(`XSpamSweeper Popup: Link resolved for @${request.username}:`, request.result);
        setStatus(`Resolved @${request.username}: ${request.result?.links?.length || 0} links found`);

        // Refresh to pick up updated spam analysis
        if (!window._refreshPending) {
            window._refreshPending = true;
            setTimeout(async () => {
                await fetchMessageRequests();
                window._refreshPending = false;
            }, 1000);
        }
    }
});

document.addEventListener('DOMContentLoaded', async () => {
    // Load custom spam patterns from options page
    if (typeof initCustomPatterns === 'function') {
        await initCustomPatterns();
    }
    await loadFilterPreference();
    await fetchMessageRequests();
});
