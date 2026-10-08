# Flashare

Send files straight from one browser to another. No server, no account, nothing uploaded.

**Live app:** https://adhiraj-shukla.github.io/FLASHARE/

## How to use

1. Both people open the Flashare page.
2. **Sender:** click *Create offer*, then share the code, link or QR.
3. **Receiver:** paste the code (or scan the QR) and click *Create answer*.
4. **Sender:** paste the answer (or scan its QR) and click *Connect*.
5. When the status says **Connected**, drop files or send messages.

## Features

- Direct browser-to-browser transfer with WebRTC, no backend
- Multiple files, progress, speed and time remaining
- SHA-256 check to confirm files arrive intact
- Text messages, custom avatar and themes
- Same-device demo: tick the box and open two tabs

## Good to know

- Open the `https` link. The camera and copy buttons need a secure page.
- Works best on the same Wi-Fi. Some strict networks and VPNs block direct connections, and there is no relay.
- The receiving device holds the whole file in memory until you save it, so very large files may struggle.

## Credits

QR codes use [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT) and [jsQR](https://github.com/cozmo/jsQR) (Apache-2.0). Flashare is MIT licensed.
