# File/Folder Last-Modified Timestamp Fix — 2026-09-21

WyteLab's file tree now keeps per-file last-modified timestamps tied to actual content/path changes rather than treating every ZIP upload as a modification.

## Behavior
- Re-uploading an identical ZIP does **not** update timestamps for unchanged files.
- In a ZIP containing 100 files where 3 contents changed, only those 3 files get a new timestamp.
- Newly added files get a new timestamp.
- Renamed/moved files get a new timestamp because their repository path changed.
- Editing a file updates that file's timestamp.
- Folder timestamps are derived from the newest changed child file, so a folder changes only when something inside it changes.
- When a file has not been opened yet, WyteLab compares the uploaded content against the existing Git blob SHA where available, so it does not need to download every file just to determine whether a ZIP entry changed.
- The UI continues to show relative time such as `now`, `3 mins ago`, or `2 hrs ago`.

## Scope
This is a local working-tree assurance feature. It does not claim that the displayed timestamp is the original timestamp of the remote GitHub file unless that file was changed during the current WyteLab working session.


## Persistent timestamp correction
The timestamp system now distinguishes local working-tree changes from remote Git history. On repository load, WyteLab loads the GitHub tree and then resolves the latest commit touching each file path through the GitHub commits API. These remote timestamps become the baseline displayed in the file explorer. After an edit/upload/create/move/delete, only affected paths receive the current local timestamp. After a successful commit, a silent reload resolves the committed timestamps from Git history, so unchanged files retain their prior modification time across sessions. Folder times are derived from the newest descendant file. Remote timestamp lookup is supplemental and failure-safe: a GitHub history/rate-limit error does not prevent the repository from opening.
