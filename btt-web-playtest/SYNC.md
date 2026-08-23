# Sync your local project here

Your files live at:

`c:\Users\NEREYDA\Desktop\btt-web-playtest`

The cloud workspace cannot access that path. Pick one:

## Option A — Upload in chat (fastest)

1. Zip the `btt-web-playtest` folder on your Desktop.
2. Drag the zip into this Cursor chat.
3. Tell the agent: "here's the project."

## Option B — Git push

If the folder is already a git repo:

```bash
git remote add cloud <this-repo-url>
git push cloud main
```

## Option C — Copy key files only

At minimum we need:

- `index.html`, `styles.css`, `manifest.webmanifest`
- `src/` (all `.js` files)
- `icons/`
- `assets/` (or whatever your build uses)

Once files are here, run `npm run dev` and we can iterate together.
