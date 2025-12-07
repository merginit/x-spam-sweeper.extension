# Changelog

All notable changes to this project will be documented in this file.

## [0.1.1] - 2025-12-07

### Added
- Initial release with core popup functionality
- Content script to extract message requests from X DOM
  - Extracts username, display name, avatar URL, message preview, and date
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
