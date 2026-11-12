# Release notes

`v<version>.md` here replaces the generated notes when that version syncs to the public repo
(`config/publishPublicRepo.ts`). The public GitHub release is what www.sheetxl.com/changelog
shows.

- Name the file for the exact version: `v0.8.0.md`. Prereleases never match, so betas keep their
  generated notes.
- Leave out the version heading; the release title and the changelog page already show it.
- Write it before the release. A file added later takes effect on the next sync of that version,
  which runs `gh release edit`.
