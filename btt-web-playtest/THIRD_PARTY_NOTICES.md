# Third-Party Notices

The ISC License in this repository applies only to material that the repository owner has authority to license. The following externally provided components retain their own licenses and are not relicensed under ISC.

## Web fonts

`redesign.css` requests these fonts from Google Fonts at runtime. Font binaries are not committed to this application or copied into the hackathon deployment artifact.

| Font | License | Source |
|---|---|---|
| Cinzel | SIL Open Font License 1.1 | <https://github.com/NDISCOVER/Cinzel> |
| DM Sans | SIL Open Font License 1.1 | <https://github.com/googlefonts/dm-fonts> |
| Instrument Serif | SIL Open Font License 1.1 | <https://github.com/Instrument/instrument-serif> |

Google Fonts is an external delivery service and is subject to Google's own terms and privacy practices.

## Development dependencies

The packages recorded in `package-lock.json` are development and QA dependencies under their respective package licenses, including MIT, ISC, Apache-2.0, and BSD-3-Clause. They are not bundled into the browser game or the allowlisted hackathon deployment artifact. The lockfile retains the package names, versions, sources, and license identifiers.

`npm run dev` can fetch the external `serve` package through `npx`, and optional art-processing scripts use the external Python Pillow library. Neither tool is committed to or bundled with the deployed game; each remains subject to its upstream license.

## Project assets

No tracked image or audio file contains an embedded third-party license notice. The root `ASSET_PROVENANCE.md` records the provenance limits identified by the repository audit.
