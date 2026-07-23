// Validate every plugins/<id>/plugin.json against the manifest schema, and
// perform cross-checks the JSON schema cannot express (id matches folder,
// declared sidecar files exist, sha256 matches on-disk bytes).
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { PLUGINS_DIR, listPluginIds, readJson, sha256File, validateManifest } from './lib.mjs'

function main() {
  const ids = listPluginIds()
  if (ids.length === 0) {
    console.log('No plugins found under plugins/. Nothing to validate.')
    return
  }

  const problems = []
  for (const id of ids) {
    const dir = join(PLUGINS_DIR, id)
    const manifestPath = join(dir, 'plugin.json')
    let manifest
    try {
      manifest = readJson(manifestPath)
      validateManifest(manifest, `plugins/${id}/plugin.json`)
    } catch (err) {
      problems.push(String(err.message ?? err))
      continue
    }

    if (manifest.id !== id) {
      problems.push(`plugins/${id}: manifest id "${manifest.id}" must match folder name "${id}".`)
    }

    if (manifest.ui?.entry && !existsSync(join(dir, manifest.ui.entry))) {
      problems.push(`plugins/${id}: ui.entry "${manifest.ui.entry}" not found.`)
    }

    for (const sc of manifest.sidecars ?? []) {
      const binPath = join(dir, sc.path)
      if (!existsSync(binPath)) {
        problems.push(`plugins/${id}: sidecar "${sc.path}" (${sc.platform}) not found.`)
        continue
      }
      const actual = sha256File(binPath)
      if (actual !== sc.sha256) {
        problems.push(
          `plugins/${id}: sidecar "${sc.path}" sha256 mismatch.\n  manifest: ${sc.sha256}\n  actual:   ${actual}`,
        )
      }
    }
    console.log(`ok  ${id}@${manifest.version}`)
  }

  if (problems.length > 0) {
    console.error(`\n${problems.length} problem(s):\n` + problems.map((p) => `- ${p}`).join('\n'))
    process.exit(1)
  }
  console.log(`\nValidated ${ids.length} plugin(s).`)
}

main()
