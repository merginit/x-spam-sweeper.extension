# Changelog

All notable changes to this project will be documented in this file.

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
