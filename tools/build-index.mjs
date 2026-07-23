// Regenerate index.json from the plugin manifests, and refresh the README
// catalog table. Package integrity (sha256/size) is read from the built
// dist/<id>-<version>.duckplug when present; otherwise any existing entry for
// that exact version is preserved. Older versions already in the index are
// kept so the catalog stays append-only.
//
// Usage: node tools/build-index.mjs
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  DIST_DIR,
  PLUGINS_DIR,
  REPO,
  ROOT,
  listPluginIds,
  rawUrl,
  readJson,
  sha256File,
  validateIndex,
  validateManifest,
  validateStore,
} from './lib.mjs'

const INDEX_PATH = join(ROOT, 'index.json')
const README_PATH = join(ROOT, 'README.md')

function releaseUrl(id, version) {
  const asset = `${id}-${version}.duckplug`
  return `https://github.com/${REPO}/releases/download/${id}-v${version}/${asset}`
}

function packageInfo(id, version, previous) {
  const local = join(DIST_DIR, `${id}-${version}.duckplug`)
  if (existsSync(local)) {
    return { url: releaseUrl(id, version), sha256: sha256File(local), size: statSync(local).size }
  }
  if (previous?.package) return previous.package
  return null
}

/** Optional per-plugin marketing metadata merged into the catalog entry. */
function storeMetadata(id) {
  const path = join(PLUGINS_DIR, id, 'store.json')
  if (!existsSync(path)) return {}
  const store = readJson(path)
  validateStore(store, `plugins/${id}/store.json`)
  const out = {}
  if (store.longDescription) out.longDescription = store.longDescription
  if (store.screenshots?.length) {
    for (const rel of store.screenshots) {
      if (!existsSync(join(PLUGINS_DIR, id, rel))) {
        throw new Error(`plugins/${id}/store.json: screenshot "${rel}" not found on disk.`)
      }
    }
    out.screenshots = store.screenshots.map((rel) => rawUrl(`plugins/${id}/${rel}`))
  }
  return out
}

function loadPreviousVersions() {
  if (!existsSync(INDEX_PATH)) return {}
  const prev = readJson(INDEX_PATH)
  const map = {}
  for (const p of prev.plugins ?? []) {
    map[p.id] = new Map((p.versions ?? []).map((v) => [v.version, v]))
  }
  return map
}

function buildCatalog(plugins) {
  if (plugins.length === 0) return '_No plugins published yet._'
  const rows = plugins.map((p) => {
    const cats = (p.categories ?? []).join(', ') || '—'
    return `| **${p.name}** | \`${p.id}\` | ${p.latest} | ${cats} | ${p.description} |`
  })
  return [
    '| Plugin | ID | Latest | Categories | Description |',
    '| ------ | -- | ------ | ---------- | ----------- |',
    ...rows,
  ].join('\n')
}

function updateReadme(plugins) {
  if (!existsSync(README_PATH)) return
  const md = readFileSync(README_PATH, 'utf8')
  const begin = '<!-- BEGIN CATALOG -->'
  const end = '<!-- END CATALOG -->'
  const i = md.indexOf(begin)
  const j = md.indexOf(end)
  if (i === -1 || j === -1) return
  const next = `${md.slice(0, i + begin.length)}\n${buildCatalog(plugins)}\n${md.slice(j)}`
  if (next !== md) writeFileSync(README_PATH, next)
}

function main() {
  const previous = loadPreviousVersions()
  const plugins = []

  for (const id of listPluginIds()) {
    const manifest = readJson(join(PLUGINS_DIR, id, 'plugin.json'))
    validateManifest(manifest, `plugins/${id}/plugin.json`)

    const versionsMap = new Map(previous[id] ?? [])
    const prevEntry = versionsMap.get(manifest.version)
    const pkg = packageInfo(id, manifest.version, prevEntry)
    if (!pkg) {
      console.warn(
        `skip ${id}@${manifest.version}: no dist package and no prior index entry — run pnpm pack:plugin ${id} first.`,
      )
    } else {
      versionsMap.set(manifest.version, {
        version: manifest.version,
        hostApiVersion: manifest.hostApiVersion,
        publishedAt: prevEntry?.publishedAt ?? new Date().toISOString(),
        ...((manifest.sidecars?.length ?? 0) > 0
          ? { platforms: manifest.sidecars.map((s) => s.platform) }
          : {}),
        package: pkg,
      })
    }

    const versions = [...versionsMap.values()].sort((a, b) =>
      a.version.localeCompare(b.version, undefined, { numeric: true }),
    )
    if (versions.length === 0) continue

    const store = storeMetadata(id)
    plugins.push({
      id,
      name: manifest.name,
      description: manifest.description,
      author: manifest.author,
      ...(manifest.homepage ? { homepage: manifest.homepage } : {}),
      ...(manifest.icon ? { icon: manifest.icon } : {}),
      ...(manifest.categories ? { categories: manifest.categories } : {}),
      ...(store.longDescription ? { longDescription: store.longDescription } : {}),
      ...(store.screenshots ? { screenshots: store.screenshots } : {}),
      latest: versions[versions.length - 1].version,
      versions,
    })
  }

  plugins.sort((a, b) => a.id.localeCompare(b.id))

  const index = {
    $schema: './schemas/index.schema.json',
    indexVersion: 1,
    generatedAt: new Date().toISOString(),
    plugins,
  }
  validateIndex(index)
  writeFileSync(INDEX_PATH, `${JSON.stringify(index, null, 2)}\n`)
  updateReadme(plugins)

  console.log(`Wrote index.json with ${plugins.length} plugin(s).`)
}

main()
