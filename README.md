# MediaPeek

Instantly analyze media files.

MediaPeek provides detailed technical metadata for video, audio, image, and subtitle files directly in your browser. It processes URLs intelligently—fetching only the necessary data segments—so you don't need to download the whole file.

The tool operates on Cloudflare Workers using MediaInfo.js to perform analysis at the edge. Server-Side Request Forgery (SSRF) protection prevents access to unauthorized local or private network resources. Analysis results can be shared securely using the integrated PrivateBin feature.

## Formats

MediaPeek supports the following output formats:

- Text
- HTML
- XML
- JSON

## Try it with these examples

You can use the following URLs to test the application:

- https://media.w3.org/2010/05/sintel/trailer.mp4
- https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4
- https://lf-tk-sg.ibytedtos.com/obj/tcs-client-sg/resources/video_demo_hevc.html
- https://kodi.wiki/view/Samples

## License

GNU GPLv3
