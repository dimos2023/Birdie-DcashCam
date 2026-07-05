# JT/T Protocol Documents

Place the official translated protocol PDFs in this folder:

- `JTT808-2019-Translated.pdf` — JT/T 808-2019 signaling
- `JTT1078-2016-English.pdf` — JT/T 1078-2016 audio/video

The Birdie `jt-gateway` service implements framing, checksums, header auto-detection (2011 vs 2019), and message routing according to these documents.

Do not invent protocol fields in code without verifying them against the PDFs.
