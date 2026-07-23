// Shared helpers for the registry tooling.
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'

export const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
export const PLUGINS_DIR = join(ROOT, 'plugins')
export const DIST_DIR = join(ROOT, 'dist')
export const SCHEMAS_DIR = join(ROOT, 'schemas')

/** Publisher/repo used to build release-asset download URLs. */
export const REPO = process.env.PLUGINS_REPO ?? 'lucasdegruijter/rubber-duck-plugins'

/** Branch raw assets (screenshots, icons) are served from. */
export const RAW_REF = process.env.PLUGINS_RAW_REF ?? 'main'

/** Build a raw.githubusercontent.com URL for a repo-relative path. */
export function rawUrl(relPath) {
  const clean = relPath.split('/').map(encodeURIComponent).join('/')
  return `https://raw.githubusercontent.com/${REPO}/${RAW_REF}/${clean}`
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

export function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

/** List plugin ids (directories under plugins/ that contain a plugin.json). */
export function listPluginIds() {
  let entries
  try {
    entries = readdirSync(PLUGINS_DIR, { withFileTypes: true })
  } catch {
    return []
  }
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((id) => {
      try {
        return statSync(join(PLUGINS_DIR, id, 'plugin.json')).isFile()
      } catch {
        return false
      }
    })
    .sort()
}

let _validators
function validators() {
  if (_validators) return _validators
  const ajv = new Ajv({ allErrors: true, strict: false })
  addFormats(ajv)
  _validators = {
    manifest: ajv.compile(readJson(join(SCHEMAS_DIR, 'plugin.schema.json'))),
    index: ajv.compile(readJson(join(SCHEMAS_DIR, 'index.schema.json'))),
    store: ajv.compile(readJson(join(SCHEMAS_DIR, 'store.schema.json'))),
  }
  return _validators
}

function formatErrors(errors) {
  return (errors ?? []).map((e) => `  ${e.instancePath || '/'} ${e.message}`).join('\n')
}

/** Validate a manifest object; throws with a readable message on failure. */
export function validateManifest(manifest, label = 'manifest') {
  const validate = validators().manifest
  if (!validate(manifest)) {
    throw new Error(`Invalid ${label}:\n${formatErrors(validate.errors)}`)
  }
}

/** Validate an index object; throws with a readable message on failure. */
export function validateIndex(index) {
  const validate = validators().index
  if (!validate(index)) {
    throw new Error(`Invalid index.json:\n${formatErrors(validate.errors)}`)
  }
}

/** Validate a store-metadata object; throws with a readable message on failure. */
export function validateStore(store, label = 'store.json') {
  const validate = validators().store
  if (!validate(store)) {
    throw new Error(`Invalid ${label}:\n${formatErrors(validate.errors)}`)
  }
}
