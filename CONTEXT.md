# MediaPeek

MediaPeek analyzes publicly reachable media sources and produces technical
metadata. This context defines the analysis and report artifacts and where
reports are stored.

## Analysis and reports

**Analysis**:
An Analysis is a request to inspect one public media source and produce
technical metadata.
_Avoid_: scan, scrape, download

**Media Report**:
A Media Report is the generated metadata result, including the requested
output formats, for one completed Analysis.
_Avoid_: media file, report card, analysis job

**Public Analysis**:
A Public Analysis is an Analysis available without an account. Its result is
available to the current browser and can be stored locally in the report
library or exported and shared by the visitor.
_Avoid_: anonymous report, guest account

**Stored Media Report**:
A Stored Media Report is a Media Report persisted in the visitor's browser
storage through the report library.
_Avoid_: cached report, saved card
