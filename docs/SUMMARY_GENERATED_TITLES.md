# Summary-generated meeting titles

PR #39 removed the summary-to-meeting-title update; @ampersandru reported the
regression. `summary/service.rs` now restores it after a successful, accepted
summary completion and before emitting completion to the frontend. Cancelled or
superseded summary completions do not run this update.

`summary/processor.rs::extract_meeting_name_from_markdown` accepts only a useful
leading H1, ignoring blank lines before it. It rejects empty/overlong names,
generic summary headings and unfilled template titles such as `<Add Title here>`.
It never searches later body headings for a name. No additional model request is
made: the existing summary template already requests a descriptive H1.

`MeetingsRepository::update_generated_meeting_title` updates the meeting and
legacy transcript-chunk display names together. Its SQL condition requires
`title_is_manual = 0`; a manual rename wins regardless of which operation commits
first. Automatically named meetings retain automatic provenance for later
regeneration. User-entered and user-selected group titles remain owned by the
user. Audio folders, transcript words and timestamps remain untouched.

The completion callback in `useSummaryGeneration.ts` already invokes
`onMeetingUpdated`; the meeting page refetches both its details and sidebar.
Tests cover title extraction/rejection, automatic-title persistence, chunk-name
synchronization, and manual rename precedence. End-to-end model-generated title
quality depends on the selected model following the summary template.

Verification: all three `generated_title` native CPU regression tests passed on
Windows. This validates extraction and persistence/ownership; it is not a live
summary-provider quality benchmark.
