// Package a plugin folder into dist/<id>-<version>.duckplug (a gzipped tarball
// with the manifest at its root) and print its SHA-256 + size.
//
// Usage: node tools/pack.mjs <id>
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { DIST_DIR, PLUGINS_DIR, readJson, sha256File, validateManifest } from './lib.mjs'

function main() {
  const id = process.argv[2]
  if (!id) {
    console.error('Usage: pnpm pack:plugin <id>')
    process.exit(2)
  }

  const dir = join(PLUGINS_DIR, id)
  const manifestPath = join(dir, 'plugin.json')
  if (!existsSync(manifestPath)) {
    console.error(`No plugin found at plugins/${id}/plugin.json`)
    process.exit(1)
  }

  const manifest = readJson(manifestPath)
  validateManifest(manifest, `plugins/${id}/plugin.json`)
  if (manifest.id !== id) {
    console.error(`manifest id "${manifest.id}" must match folder name "${id}".`)
    process.exit(1)
  }

  mkdirSync(DIST_DIR, { recursive: true })
  const outName = `${id}-${manifest.version}.duckplug`
  const outPath = join(DIST_DIR, outName)

  // Deterministic-ish tarball: package contents relative to the plugin dir so
  // plugin.json sits at the archive root. `tar` ships on macOS, Linux and
  // Windows 10+. Excludes any accidental nested dist output.
  execFileSync(
    'tar',
    ['--exclude', './dist', '-czf', outPath, '-C', dir, '.'],
    { stdio: 'inherit' },
  )

  const sha256 = sha256File(outPath)
  const size = statSync(outPath).size
  writeFileSync(`${outPath}.sha256`, `${sha256}  ${outName}\n`)

  console.log(`\nPacked ${outName}`)
  console.log(`  path:   dist/${outName}`)
  console.log(`  size:   ${size} bytes`)
  console.log(`  sha256: ${sha256}`)
}

main()
