# MediaPeek

<p align="center">
  <img src="resources/app_icons/MediaPeek-Dark-Default-1024x1024@1x.png" width="200" alt="MediaPeek Icon">
</p>

MediaPeek provides detailed technical metadata for video, audio, image, and subtitle files directly in your browser. It processes URLs intelligently—fetching only the necessary data segments—so you don't need to download the whole file.

![MediaPeek Demo](resources/preview.png)

## Features

### Edge Analysis

Fetches only necessary data segments—no full file downloads required.

### Archive Extraction

Transparently unpacks media from common archive formats:

- **ZIP**: Stored and DEFLATE-compressed archives.
- **TAR**: Standard tar archives (including `@LongLink` extended headers).

The original archive name is displayed alongside the inner filename for context.

### Supported Sources

- **Web Servers**: HTTP/HTTPS URLs. Optimized for byte-range requests.
- **Google Drive**: Public files and folders.

### Secure Sharing

End-to-end encrypted result sharing via PrivateBin.

### Output Formats

Export metadata as Object, JSON, Text, HTML, or XML.

### Security

SSRF protection blocks requests to local and private network resources.

## Try It

Test with these sample URLs:

### Video Samples

- [Sintel Trailer](https://media.w3.org/2010/05/sintel/trailer.mp4)
- [ForBiggerBlazes Clip](https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4)
- [HEVC Videos](https://lf-tk-sg.ibytedtos.com/obj/tcs-client-sg/resources/video_demo_hevc.html)

### Audio Samples

- [MPEG-H Audio](https://mpegh.com/academy/testing-and-qa/)
- [Dolby AC-4 Online Delivery Kit](https://ott.dolby.com/OnDelKits/AC-4/Dolby_AC-4_Online_Delivery_Kit_1.5/help_files/topics/kit_wrapper_MP4_multiplexed_streams.html)
- [PeterPee Atmos](https://www.peterpee.com/demo)

### Community Collections

- [Kodi Samples](https://kodi.wiki/view/Samples)
- [Netflix Open Content](https://opencontent.netflix.com/)
- [Jellyfin Test Videos](https://repo.jellyfin.org/test-videos/)
- [4K-8K Dolby Vision Samples by Salty01](https://drive.google.com/drive/folders/1yAq-jgsb8pYa92PnGZkxyEV0E3VVkhiC)
- [Surround Sound by Buzz*Buzz_Buzz*](https://drive.google.com/drive/folders/1JxmeedtAtgmoafXv9rroiDOS2vEX7N4b)
- [Dolby Vision, Atmos, DTS-X Demos](https://1drv.ms/f/c/999a020cf5718098/EobEBJqZ92ZFipImX5WugTUB7xX5r5ko-omYcTJQ9chLPA)

## License

**MediaPeek** is released under the GNU GPLv3.

### Acknowledgments

- **MediaInfo**: Copyright © 2002–2023 MediaArea.net SARL. Analysis is powered by [mediainfo.js](https://github.com/buzz/mediainfo.js), a WebAssembly port of [MediaInfoLib](https://github.com/MediaArea/MediaInfoLib). ([License](https://mediaarea.net/en/MediaInfo/License))

- **PrivateBin**: Enables secure sharing of results. ([License](https://github.com/PrivateBin/PrivateBin/blob/master/LICENSE.md))

- **Apple Services Badges**: The video format badges (Dolby, Immersive, 3D, HD, 4K, HDR, HDR10+) are sourced from [Apple TV](https://tv.apple.com/), while the audio badges (Lossless, Hi-Res Lossless, Apple Digital Master, Spatial Audio, AAC) are sourced from [Apple Music](https://music.apple.com/). Special thanks to @SuperSaltyGamer for providing the Apple Music SVG badges. These designs were selected for their visual perfection and clarity, which align seamlessly with MediaPeek's aesthetic.

- **Cloudflare Workers**: Hosted on [Cloudflare Workers](https://workers.cloudflare.com/). MediaPeek benefits from their generous free tier.
