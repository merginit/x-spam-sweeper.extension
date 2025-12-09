# Changelog

All notable changes to this project will be documented in this file.

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
