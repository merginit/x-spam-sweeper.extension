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
const refreshBtn = document.getElementById('refreshBtn');
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

    // Update select all checkbox state
    if (count === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
    } else if (count === messageRequests.length) {
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
 * Select or deselect all requests
 */
function toggleSelectAll() {
    if (selectedUsernames.size === messageRequests.length) {
        selectedUsernames.clear();
    } else {
        messageRequests.forEach(req => selectedUsernames.add(req.username));
    }
    updateSelectionUI();
    messageRequests.forEach(req => updateRequestItemUI(req.username));
}

/**
 * Create HTML for a request item
 */
function createRequestItem(request) {
    const isSelected = selectedUsernames.has(request.username);

    const item = document.createElement('div');
    item.className = `request-item${isSelected ? ' selected' : ''}`;
    item.dataset.username = request.username;

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
        <span class="request-date">${escapeHtml(request.date)}</span>
      </div>
      <div class="request-message">${escapeHtml(request.messagePreview)}</div>
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
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
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

    messageRequests.forEach(request => {
        requestsList.appendChild(createRequestItem(request));
    });

    showState('list');
    updateSelectionUI();
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

        // Send message to content script
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getMessageRequests' });

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
        renderRequestsList();

        if (messageRequests.length > 0) {
            setStatus(`Found ${messageRequests.length} message request${messageRequests.length !== 1 ? 's' : ''}`);
        }

    } catch (error) {
        console.error('XSpamSweeper: Error fetching requests', error);

        if (error.message?.includes('Could not establish connection')) {
            showError('Content script not loaded. Please refresh the page.', true);
        } else {
            showError('Failed to fetch message requests. Please try again.');
        }
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

// Report and Block buttons (placeholder for now)
reportBtn.addEventListener('click', () => {
    const selected = Array.from(selectedUsernames);
    setStatus(`Report ${selected.length} accounts - Coming soon!`);
    console.log('Report accounts:', selected);
});

blockBtn.addEventListener('click', () => {
    const selected = Array.from(selectedUsernames);
    setStatus(`Block ${selected.length} accounts - Coming soon!`);
    console.log('Block accounts:', selected);
});

document.addEventListener('DOMContentLoaded', fetchMessageRequests);
