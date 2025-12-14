# Changelog

All notable changes to this project will be documented in this file.

## [0.2.9] - 2025-12-14

### Improved
- **Settings UI Polish**:
  - **Disabled Add Buttons**: Add buttons are now disabled when input fields are empty.
  - **Normal Text Editing**: Editable text fields now behave like standard text inputs (cursor placement on click, no auto-select).
  - **Number Input Spinners**: Always-visible up/down spinners on number inputs, styled to match the dark theme.

---

## [0.2.8] - 2025-12-14

### Improved
- **Settings UI Enhancements**:
  - **Domain/URL Validation**: URL pattern input now validates that entries are valid domains (e.g. `spam.com`) or URLs. Invalid formats are rejected with an error message.
  - **Editable Entries**: Click on any pattern or keyword text to edit it inline. Press Enter to save or Escape to cancel. Changes are automatically validated and persisted.
  - **Editable Scores**: Keyword weights are now editable number inputs instead of static text. Click to change the score directly.
  - **Better Delete Icons**: Replaced the X icon with a properly centered trash icon for better visual alignment.
  - **Improved Spacing**: Added proper spacing between score badges and delete buttons for cleaner layout.

---

## [0.2.7] - 2025-12-14

### Improved
- **Spam Score Calibration (0–30 Scale)**: Redesigned scoring system with consistent 0–30 point scale and clear risk thresholds (≥20 = HIGH, ≥10 = MEDIUM, ≥3 = LOW).
- **Hidden Link Detection**: "Sent a link" messages now receive +10 base score (MEDIUM risk) until the background worker resolves the actual URL.
- **Safe Domain Negative Scoring**: Links to YouTube, Spotify, GitHub, etc. now subtract 10 points, preventing false positives when new friends share legitimate content.
- **High-Risk URL Scoring**: Bumped from +15 to +20 points for WhatsApp/Telegram/OnlyFans links. Medium-risk URLs bumped from +8 to +10.
- **Score Clamping**: Scores are now clamped between 0 and 30 to ensure consistent UI behavior.

---

## [0.2.6] - 2025-12-14

### Security
- **Safe t.co Resolution**: Replaced unsafe tab navigation with `webRequest.onBeforeRedirect` to capture redirect URLs without loading potentially malicious destination pages. The destination site's JavaScript never executes.

---

## [0.2.5] - 2025-12-13

### Fixed
- **Message-Scoped Link Extraction**: Link extraction now searches ONLY within message elements (`card.wrapper`, `messageEntry`, `message-text`, message list items). Previously searched entire page including sidebar, causing user's own profile links to appear in results.
- **t.co Shortlink Resolution**: Resolves t.co shortlinks by navigating to them and capturing the final URL after redirect. This properly identifies the actual spam domains.
- **Current User Domain Filtering**: Extracts domains from the logged-in user's bio and website, then filters out any links matching those domains from spam detection results.
- **Link Deduplication**: Removes duplicate URLs after t.co resolution (e.g., when both t.co link and domain text resolve to same URL).

### Added
- **Link Aggregator Detection**: Added `allmylinks.com`, `getmysocial.com`, `beacons.ai`, `solo.to`, and `linktr.ee` to MEDIUM_RISK URL patterns (suspicious).

---

## [0.2.4] - 2025-12-13

### Fixed
- **Sensitive Content Profiles**: Auto-click "Yes, view profile" for accounts flagged by X
- **Link Extraction**: Extract actual domains from link card descriptions (OLD UI) and `.font-chirp` URLs (NEW UI)

---

## [0.2.3] - 2025-12-13

### Added
- **Options Page**:
  - Custom high-risk URL patterns management
  - Custom keyword weights configuration
  - Settings saved to chrome.storage.sync
  - Dark theme UI matching popup design

---

## [0.2.2] - 2025-12-13

### Added
- **Hidden Link Resolution**:
  - Background worker pattern with queue management and rate limiting (3s delay).
  - Worker tab navigates to profiles to extract actual links from "Sent a link" messages.
  - New "Resolve Links" button in popup header to trigger link resolution.
  - Popup auto-refreshes when links are resolved.

---

## [0.2.1] - 2025-12-13

### Added
- **SPA Navigation Support**:
  - MutationObserver detects new DM rows when scrolling.
  - URL change detection for SPA navigation.
  - Popup auto-refreshes when content changes.

---

## [0.2.0] - 2025-12-13

### Added
- **Spam Detection (Issue #2)**: Privacy-first spam filtering without cloud APIs.
  - Created `spam-patterns.js` with centralized pattern configuration.
  - URL blocklist: Adult content (OnlyFans, Fansly, etc.), off-platform redirects (WhatsApp, Telegram), suspicious shorteners (bit.ly, discord.gg).
  - Keyword weights for crypto/investment scams, urgency tactics, romance scams.
  - Safe domain whitelist (YouTube, Twitter/X, Spotify, GitHub, etc.).
  - `calculateSpamScore()` and `getSpamInfo()` functions for risk assessment.
- **Visual Spam Indicators**: 
  - Red border + "SPAM" badge for high-risk messages.
  - Yellow border + "SUS" badge for medium-risk messages.
  - Green border for low-risk messages with score.
  - "Hidden link" indicator for "Sent a link" placeholders.
- **Filter Toggle**: Shield button in header to show only suspicious messages.
  - Toggle between "Show All" and "Show Spam Only" modes.
  - Preference saved to chrome.storage.

### Changed
- Bumped version to 0.2.0, added `storage` permission.
- Updated content script loading order: `spam-patterns.js` → `shared.js` → `content.js`.

---

## [0.1.13] - 2025-12-11

### Changed
- **Code Refactoring**: Moved shared utility functions to `shared.js` to reduce code duplication across the extension.
  - Moved `escapeHtml`, `nativeClick`, `delay`, `clickElementWithText`, `clickSubmitButtons`, `waitForElement`, `waitForElementToDisappear`, and `extractTextWithEmojis` to shared module.
  - Updated `popup.js` and `content.js` to use shared utilities.
  - Added `shared.js` to content scripts in manifest for proper loading order.

---

## [0.1.12] - 2025-12-10

### Fixed
- **Report Automation with Flag Check**: Restored auto-trigger code with `sessionStorage` flag check. Extension sets `xSpamSweeperAutoReport` flag before triggering report; iframe automation only runs if this flag is present. Manual user reports no longer trigger automation.

## [0.1.11] - 2025-12-10

### Fixed
- **Link Message Display**: Fixed issue where messages containing links showed blank preview instead of "Sent a link" text.

---

## [0.1.10] - 2025-12-10

### Fixed
- **Report Automation**: Restored missing `clickSubmitButtons` function in content script that caused report actions to fail silently.

## [0.1.9] - 2025-12-10

### Added
- **Assets**: Added `assets/preview.png`.

## [0.1.8] - 2025-12-10

### Fixed
- **Photo/Media Message Display**: Fixed issue where messages containing photos, videos, GIFs, or other media showed blank preview instead of "Sent a photo" text.

### Changed
- **Enhanced Message Extraction**: Added fallback detection for media message indicators when standard `tweetText` element is not present.

---

## [0.1.7] - 2025-12-09

### Added
- **Extension Icon**: Added custom icon for the extension (toolbar, extensions page, and store).

---

## [0.1.6] - 2025-12-09

### Fixed
- **Sweep False Failures**: Sweep now correctly reports success when X auto-removes conversations after reporting (e.g., when "Block @user" option is selected).
- **Delete Functionality**: Fixed delete not working - removed confirmation dialog handling.
- **Report Completion Detection**: Now properly detects "Block @username" and "Mute @username" buttons as valid report completion signals.

### Changed
- **Smart Conversation Tracking**: Added `isConversationStillVisible()` to detect when conversations are auto-removed by X.
- **Skip Already Gone**: Sweep now skips block/delete steps if conversation disappears after report, marking as success.
- **No Auto-Trigger**: Report iframe automation no longer runs automatically - only when extension explicitly initiates a report. This prevents interfering with manual reports.

### Removed
- Duplicate report automation code from content.js (kept only background.js version).

---

## [0.1.5] - 2025-12-07

### Fixed
- **Critical Report Automation**: Solved issue where "It's spam" and "Submit" buttons were not clickable in the report iframe.
- **Smart Quote Handling**: Added normalization for typographic apostrophes (`It’s` vs `It's`).
- **Button Detection**: Added explicit support for "Send report to X" buttons and fallback mechanisms.

### Changed
- **Enhanced Click Simulation**: Updated `nativeClick` to dispatch full `pointer` and `mouse` event sequences for better React compatibility.
- **Aggressive Interaction Strategy**: Script now intelligently targets interactive parents and exhaustively clicks valid candidates to bypass ephemeral event listeners.

---

## [0.1.4] - 2025-12-07

### Added
- **Functional actions**: Delete, Block, Report now work (report works partially) via DOM automation
- **Sweep** performs Report → Block → Delete sequentially
- `all_frames: true` manifest setting for report iframe support
- Sequential batch processing with progress status
- Automatic spam selection in report dialog iframe (theoretically)

### Changed
- Actions now perform real DOM automation instead of placeholders

---

## [0.1.3] - 2025-12-07

### Added
- "Sweep" button for combined action (Report + Block + Delete in one click)
- Delete conversation button
- Options menu button with dropdown submenu
- Individual actions (Delete, Block, Report) in submenu with descriptions

### Changed
- Moved Report and Block buttons from action bar into dropdown submenu
- Redesigned action bar with X-style UI patterns

---

## [0.1.2] - 2025-12-07

### Added
- Automatic content script injection when connection fails
- `scripting` permission for programmatic script injection

### Fixed
- "Could not establish connection" error when page was loaded before extension

---

## [0.1.1] - 2025-12-07

### Added
- Initial release with core popup functionality
- Content script to extract message requests from X DOM
  - Extracts username, display name, avatar URL, message preview, and date
  - Preserves emojis in names and messages
  - Only activates on `x.com/messages/requests`
- Popup UI with dark theme matching X's design
  - Header with refresh button
  - Action bar with Select All checkbox
  - Report and Block buttons (UI only, functionality coming soon)
  - Scrollable list of message requests with multi-select
  - Loading, empty, and error states
- Manifest V3 configuration
  - Content scripts for x.com and twitter.com
  - activeTab and tabs permissions
