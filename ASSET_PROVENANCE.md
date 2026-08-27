# Asset Provenance

This document records what can and cannot be established from the tracked Beneath the Throne mobile/web repository. It is not a claim of ownership over material supplied by another party.

## Repository scope

The repository contains 389 tracked image files under `btt-web-playtest/assets/` and `btt-web-playtest/icons/`, including 359 raster files. The project owner has approved an ISC release of the owner-created contents of this mobile/web side project. The separate Beneath the Throne Unreal Engine project is outside this repository and outside this license grant.

The owner has confirmed, to the best of their knowledge, the right to distribute the owner-created, AI-generated, generated, restored, processed, and uncertain-original artwork currently used by this repository, and has approved public release of this mobile/web project only.

## Generated and processed artwork

Many raster files use `generated` directory names, and local scripts can install, resize, composite, recolor, or derive artwork.

A binary metadata audit found C2PA/JUMBF data in 79 tracked raster assets naming `OpenAI Media Service API`. A sampled record identifies `gpt-image` version `2.0`, the `c2pa.created` action, and a `trainedAlgorithmicMedia` digital source type. The affected set includes assets in `ministops`, `battlebacks`, `towns`, `worldstates`, `ui`, and `interiors`, plus several atlas, map, and tutorial files. This records an AI-generation mechanism for that subset; it does not identify the account that requested the output, prove ownership, or grant a license. The audit did not independently validate the embedded signatures.

This is a lower bound on generated media because resizing, compositing, and other image-processing steps can remove provenance metadata. The tracked history and remaining image metadata do not retain a generator, account, prompt, source file, or license record for every raster asset. Accordingly, the repository itself cannot independently prove the creation history of each image.

The ISC license applies to these files only to the extent that the repository owner created them or otherwise holds the rights necessary to license them. It does not override third-party rights.

## Restoration source

`btt-web-playtest/scripts/repair-assets.mjs` can restore missing game files from:

`https://hillbillyai.com/games/beneath-the-throne/game/`

That URL is recorded as a prior deployment/restoration source, not as evidence that an unrelated third party owns the files. The repository owner has confirmed that the prior `hillbillyai.com` deployment was their project or an authorized deployment of it and, to the best of their knowledge, that they have the right to distribute the restored project artwork.

## Locally synthesized assets

The repair and art-processing scripts can create fallback SVGs and derived PNGs from existing project assets. Those transformations do not establish rights in their inputs; the input assets must still be owner-created or properly licensed.

## Audio

`btt-web-playtest/src/audioEngine.js` generates procedural sound effects and looping beds in code. No bundled audio sample files were found in the tracked runtime asset trees.

## Reporting an issue

If any tracked asset is later identified as third-party material, record its source and license in `THIRD_PARTY_NOTICES.md` and exclude or replace it if its terms are incompatible with redistribution.
