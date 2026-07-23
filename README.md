# Rubber Duck Plugins

The official plugin registry for **[Rubber Duck](https://github.com/lucasdegruijter/rubber-duck)** —
the cross-platform desktop devtool host for macOS and Windows.

Rubber Duck is a plugin host: every feature (including the built-in PR monitor)
ships as a plugin. This repository is the **catalog** the app reads to discover,
install, and update those plugins.

> Internal developer tool. Plugins run native code with no signing — install
> only plugins published from this repository.

## How it works

```
app  ──fetch──▶  index.json  ──lists──▶  .duckplug packages (GitHub Releases)
 │                                              │
 └── downloads a package, verifies its SHA-256, unpacks it, and runs it
```

- **`index.json`** — the machine-readable catalog the app fetches. Generated from
  published packages; do not edit by hand.
- **GitHub Releases** — host the `.duckplug` package files referenced by the index.
- **`plugins/<id>/`** — source for each first-party plugin.

## Plugin package format (`.duckplug`)

A `.duckplug` is a gzipped tarball with a manifest at its root:

```
plugin.json          # manifest (see schemas/plugin.schema.json)
ui/index.html        # web-bundle UI, served over the plugin:// protocol
bin/<platform>/…     # optional native sidecar executable(s)
icon.png             # optional
```

### Manifest (`plugin.json`)

Validated against [`schemas/plugin.schema.json`](schemas/plugin.schema.json).

```json
{
  "$schema": "https://github.com/lucasdegruijter/rubber-duck-plugins/schemas/plugin.schema.json",
  "id": "linak-desk",
  "name": "LINAK Desk Control",
  "version": "1.0.0",
  "description": "Control a LINAK sit/stand desk over USB.",
  "author": "Rubber Duck",
  "hostApiVersion": 1,
  "categories": ["hardware"],
  "ui": { "entry": "ui/index.html" },
  "sidecars": [
    { "platform": "macos-arm64", "path": "bin/macos-arm64/linak-desk", "sha256": "…" },
    { "platform": "windows-x64", "path": "bin/windows-x64/linak-desk.exe", "sha256": "…" }
  ],
  "permissions": ["usb", "settings", "tray"]
}
```

| Field            | Required | Notes                                                        |
| ---------------- | :------: | ------------------------------------------------------------ |
| `id`             |    ✓     | kebab-case; install dir, settings namespace, and IPC origin. |
| `version`        |    ✓     | semver.                                                      |
| `hostApiVersion` |    ✓     | Major host API version; the app rejects incompatible plugins.|
| `ui.entry`       |          | Web-bundle entry HTML. Omit for headless plugins.            |
| `sidecars[]`     |          | Per-platform executables; each verified by `sha256`.         |
| `permissions[]`  |          | Advisory today, enforced later.                              |

Platform identifiers: `macos-arm64`, `macos-x64`, `windows-x64`, `linux-x64`.

## Publishing a plugin

```bash
pnpm install                     # one-time
pnpm validate                    # validate every plugins/<id>/plugin.json
pnpm pack:plugin <id>            # build dist/<id>-<version>.duckplug (+ sha256)
```

Then create a GitHub Release, upload the `.duckplug` asset, and regenerate the
catalog:

```bash
pnpm build:index                 # rebuild index.json from released packages
```

CI runs `pnpm validate` on every push and pull request (see
[.github/workflows/validate.yml](.github/workflows/validate.yml)). Regenerate
`index.json` locally with `pnpm build:index` after packaging, and commit it.

## Catalog

<!-- BEGIN CATALOG -->
| Plugin | ID | Latest | Categories | Description |
| ------ | -- | ------ | ---------- | ----------- |
| **Hello Duck** | `hello-duck` | 1.0.0 | fun | Minimal example plugin — a template for building your own Rubber Duck plugin. |
| **LINAK Desk** | `linak-desk` | 0.1.0 | productivity, hardware | Control your LINAK sit/stand desk with keyboard shortcuts and sit/stand reminders. |
| **PR Monitor** | `pr-monitor` | 0.1.0 | development, monitoring | Monitor your GitHub pull requests, CI status, and review requests from the menu bar. |
<!-- END CATALOG -->

## Contributing

1. Add your plugin under `plugins/<id>/` with a valid `plugin.json`.
2. Run `pnpm validate` and `pnpm pack:plugin <id>`.
3. Open a PR. Once merged and released, `index.json` is regenerated.

## License

[MIT](LICENSE)
