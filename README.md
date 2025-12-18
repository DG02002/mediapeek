# MediaPeek

MediaPeek analyzes video, audio, image, and subtitle files to provide detailed technical metadata. The application processes URLs without downloading the entire file. By fetching only the necessary data segments, MediaPeek optimizes bandwidth and processing efficiency.

The tool operates on Cloudflare Workers using MediaInfo.js to perform analysis at the edge. Server-Side Request Forgery (SSRF) protection prevents access to unauthorized local or private network resources. Analysis results can be shared securely using the integrated PrivateBin feature.

## Formats

MediaPeek supports the following output formats:

- Text (Standard MediaInfo)
- Minimal (Custom view optimized for mobile)
- HTML
- XML
- JSON

## License

GNU GPLv3
