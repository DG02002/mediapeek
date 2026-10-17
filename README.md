<p align="center">
  <img src="resources/app_icons/MediaPeek-Dark-Default-1024x1024@1x.png" alt="MediaPeek Icon" width="200"/>
</p>
<h1 align="center">MediaPeek</h1>

MediaPeek provides detailed technical metadata for video, audio, image, and subtitle files directly in the browser. It fetches only the data segments needed for analysis, without downloading the full file first.

![MediaPeek Demo](resources/preview.png)

## Docs

- [Contributing and development](CONTRIBUTING.md)
- [Analyzer API and configuration](apps/mediapeek-analyzer/README.md)

## Features

| Capability | What it gives you |
| --- | --- |
| **Range-based analysis** | Reads only the parts of a remote file that MediaInfo needs instead of downloading the full asset first. |
| **Archive-aware inspection** | Opens supported media inside `.zip` and `.tar` archives and keeps both archive and inner filenames visible. |
| **Flexible sources** | Works with direct HTTP/HTTPS media URLs and supported public sources such as Google Drive files and folders. |
| **Multiple output formats** | Exports metadata as Object, JSON, Text, HTML, or XML for inspection, sharing, or reuse. |
| **Secure result sharing** | Shares reports through end-to-end encrypted PrivateBin links. |
| **Safer fetch pipeline** | Blocks local and private network targets to reduce SSRF risk. |

## Try It

> [!TIP]
> Direct links below can be pasted into MediaPeek as-is. Webpage links are useful sample sources, but they usually require opening the page first and copying a media file URL.

### Direct Media Links

Sintel Trailer

```text
https://media.w3.org/2010/05/sintel/trailer.mp4
```

ForBiggerBlazes Clip

```text
https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4
```

### Webpage Links

- [HEVC Videos](https://lf-tk-sg.ibytedtos.com/obj/tcs-client-sg/resources/video_demo_hevc.html)
- [MPEG-H Audio](https://mpegh.com/academy/testing-and-qa/)
- [Dolby AC-4 Online Delivery Kit](https://ott.dolby.com/OnDelKits/AC-4/Dolby_AC-4_Online_Delivery_Kit_1.5/help_files/topics/kit_wrapper_MP4_multiplexed_streams.html)
- [PeterPee Atmos](https://www.peterpee.com/demo)
- [Kodi Samples](https://kodi.wiki/view/Samples)
- [Netflix Open Content](https://opencontent.netflix.com/)
- [Jellyfin Test Videos](https://repo.jellyfin.org/test-videos/)
- [4K-8K Dolby Vision Samples by Salty01](https://drive.google.com/drive/folders/1yAq-jgsb8pYa92PnGZkxyEV0E3VVkhiC)
- [Surround Sound by Buzz*Buzz_Buzz*](https://drive.google.com/drive/folders/1JxmeedtAtgmoafXv9rroiDOS2vEX7N4b)
- [Dolby Vision, Atmos, DTS-X Demos](https://1drv.ms/f/c/999a020cf5718098/EobEBJqZ92ZFipImX5WugTUB7xX5r5ko-omYcTJQ9chLPA)

## Known Issues

- [x] **Archive bitrate accuracy**. Fixed in [d782473](https://github.com/DG02002/mediapeek/commit/d7824738b9f94b963b0370f7faa4733d771ce767). MediaPeek now corrects file size and bitrate for archive-backed media when the inner entry size can be verified from archive metadata. If the inner size cannot be verified reliably, the UI marks the result as archive-estimated and shows an info tooltip.

- [x] **MediaInfo seek reads over lazy HTTP range fetches**. Fixed in [5fa672a](https://github.com/DG02002/mediapeek/commit/5fa672aaab37b5a847183416b5e5083347387209) with a patch shared by `@cjee21` during discussion of a similar MediaInfo macOS build bug in [MediaInfoLib #2555](https://github.com/MediaArea/MediaInfoLib/issues/2555).

## License

**MediaPeek** is released under the GNU GPLv3.

### Acknowledgments

- **MediaInfo**: Copyright © 2002–2023 MediaArea.net SARL. Analysis is powered by [mediainfo.js](https://github.com/buzz/mediainfo.js), a WebAssembly port of [MediaInfoLib](https://github.com/MediaArea/MediaInfoLib). ([License](https://mediaarea.net/en/MediaInfo/License))

- **PrivateBin**: Enables secure sharing of results. ([License](https://github.com/PrivateBin/PrivateBin/blob/master/LICENSE.md))

- **Apple Services Badges**: Video badge assets, including SD, HD, 4K, HDR, HDR10+, Dolby, Immersive, and 3D, are sourced from [Apple TV](https://tv.apple.com/), while audio badge assets (Lossless, Hi-Res Lossless, Apple Digital Master, Spatial Audio, AAC) are sourced from [Apple Music](https://music.apple.com/). Special thanks to @SuperSaltyGamer for providing the Apple Music SVG badges. These designs were selected for their visual clarity and strong fit with MediaPeek's interface.

- **Cloudflare Workers**: Hosted on [Cloudflare Workers](https://workers.cloudflare.com/). MediaPeek benefits from their generous free tier.
