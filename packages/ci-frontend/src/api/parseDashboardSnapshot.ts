import type { DashboardSnapshot } from './types'

type JsonObject = Record<string, unknown>

const signalStates = ['success', 'failure', 'running', 'unknown']
const reviewSignalStates = ['clean', 'outstanding', 'pending', 'disabled']
const ciTrendStates = ['noData', 'passing', 'failing']

function invalid(path: string, expected: string): never {
  throw new Error(`Invalid dashboard snapshot at ${path}: expected ${expected}`)
}

function objectAt(value: unknown, path: string): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) invalid(path, 'object')
  return value as JsonObject
}

function stringAt(value: unknown, path: string): void {
  if (typeof value !== 'string') invalid(path, 'string')
}

function numberAt(value: unknown, path: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) invalid(path, 'finite number')
}

function booleanAt(value: unknown, path: string): void {
  if (typeof value !== 'boolean') invalid(path, 'boolean')
}

function arrayAt(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) invalid(path, 'array')
  return value
}

function nullable(value: unknown, path: string, validate: (value: unknown, path: string) => void): void {
  if (value !== null) validate(value, path)
}

function optional(value: unknown, path: string, validate: (value: unknown, path: string) => void): void {
  if (value !== undefined) validate(value, path)
}

function enumAt(value: unknown, path: string, values: readonly string[], expected: string): void {
  if (typeof value !== 'string' || !values.includes(value)) invalid(path, expected)
}

function validateWorkflowRun(value: unknown, path: string): void {
  const object = objectAt(value, path)
  nullable(object.status, `${path}.status`, stringAt)
  nullable(object.conclusion, `${path}.conclusion`, stringAt)
  stringAt(object.htmlUrl, `${path}.htmlUrl`)
  stringAt(object.title, `${path}.title`)
  numberAt(object.runNumber, `${path}.runNumber`)
  nullable(object.branch, `${path}.branch`, stringAt)
  nullable(object.event, `${path}.event`, stringAt)
  stringAt(object.updatedAt, `${path}.updatedAt`)
  optional(object.repository, `${path}.repository`, (nested, nestedPath) => nullable(nested, nestedPath, stringAt))
  optional(object.workflowFile, `${path}.workflowFile`, (nested, nestedPath) => nullable(nested, nestedPath, stringAt))
}

function validateWorkflowSnapshot(value: unknown, path: string): void {
  const object = objectAt(value, path)
  stringAt(object.name, `${path}.name`)
  stringAt(object.file, `${path}.file`)
  enumAt(object.state, `${path}.state`, signalStates, 'signal state')
  nullable(object.lastRun, `${path}.lastRun`, validateWorkflowRun)
}

function validateReviewSignal(value: unknown, path: string): void {
  const object = objectAt(value, path)
  stringAt(object.name, `${path}.name`)
  enumAt(object.state, `${path}.state`, reviewSignalStates, 'review signal state')
  optional(object.count, `${path}.count`, (nested, nestedPath) => nullable(nested, nestedPath, numberAt))
  optional(object.htmlUrl, `${path}.htmlUrl`, (nested, nestedPath) => nullable(nested, nestedPath, stringAt))
}

function validatePullRequest(value: unknown, path: string): void {
  const object = objectAt(value, path)
  numberAt(object.number, `${path}.number`)
  stringAt(object.title, `${path}.title`)
  stringAt(object.author, `${path}.author`)
  stringAt(object.htmlUrl, `${path}.htmlUrl`)
  booleanAt(object.isDraft, `${path}.isDraft`)
  stringAt(object.createdAt, `${path}.createdAt`)
  optional(object.reviewSignals, `${path}.reviewSignals`, (nested, nestedPath) => nullable(nested, nestedPath, (items, itemsPath) => {
    arrayAt(items, itemsPath).forEach((item, index) => validateReviewSignal(item, `${itemsPath}[${index}]`))
  }))
  optional(object.readyToMerge, `${path}.readyToMerge`, (nested, nestedPath) => nullable(nested, nestedPath, booleanAt))
}

function validateRepoMetrics(value: unknown, path: string): void {
  const object = objectAt(value, path)
  numberAt(object.nloc, `${path}.nloc`)
  numberAt(object.avgComplexity, `${path}.avgComplexity`)
  numberAt(object.functionCount, `${path}.functionCount`)
  numberAt(object.highComplexityCount, `${path}.highComplexityCount`)
  stringAt(object.computedAt, `${path}.computedAt`)
}

function validateJobSignal(value: unknown, path: string): void {
  const object = objectAt(value, path)
  stringAt(object.workflow, `${path}.workflow`)
  stringAt(object.name, `${path}.name`)
  enumAt(object.state, `${path}.state`, signalStates, 'signal state')
  stringAt(object.htmlUrl, `${path}.htmlUrl`)
  stringAt(object.updatedAt, `${path}.updatedAt`)
}

function validateMergedPr(value: unknown, path: string): void {
  const object = objectAt(value, path)
  numberAt(object.number, `${path}.number`)
  stringAt(object.title, `${path}.title`)
  stringAt(object.author, `${path}.author`)
  stringAt(object.repo, `${path}.repo`)
  stringAt(object.htmlUrl, `${path}.htmlUrl`)
  stringAt(object.mergedAt, `${path}.mergedAt`)
}

function validateRepositorySnapshot(value: unknown, path: string): void {
  const object = objectAt(value, path)
  stringAt(object.name, `${path}.name`)
  stringAt(object.htmlUrl, `${path}.htmlUrl`)
  booleanAt(object.private, `${path}.private`)
  arrayAt(object.workflows, `${path}.workflows`).forEach((item, index) => validateWorkflowSnapshot(item, `${path}.workflows[${index}]`))
  arrayAt(object.pullRequests, `${path}.pullRequests`).forEach((item, index) => validatePullRequest(item, `${path}.pullRequests[${index}]`))
  nullable(object.metrics, `${path}.metrics`, validateRepoMetrics)
  nullable(object.deploys, `${path}.deploys`, (items, itemsPath) => {
    arrayAt(items, itemsPath).forEach((item, index) => validateJobSignal(item, `${itemsPath}[${index}]`))
  })
  nullable(object.packages, `${path}.packages`, (items, itemsPath) => {
    arrayAt(items, itemsPath).forEach((item, index) => validateJobSignal(item, `${itemsPath}[${index}]`))
  })
  optional(object.lastMergedPr, `${path}.lastMergedPr`, (nested, nestedPath) => nullable(nested, nestedPath, validateMergedPr))
}

function validateSummaryCount(value: unknown, path: string): void {
  const object = objectAt(value, path)
  stringAt(object.key, `${path}.key`)
  numberAt(object.count, `${path}.count`)
  optional(object.unavailable, `${path}.unavailable`, booleanAt)
}

function validateCiTrendBucket(value: unknown, path: string): void {
  const object = objectAt(value, path)
  stringAt(object.bucketStart, `${path}.bucketStart`)
  enumAt(object.state, `${path}.state`, ciTrendStates, 'CI trend state')
  optional(object.isBackfilled, `${path}.isBackfilled`, booleanAt)
}

function validateDashboardSnapshot(value: unknown, path: string): void {
  const object = objectAt(value, path)
  stringAt(object.refreshedAt, `${path}.refreshedAt`)
  stringAt(object.org, `${path}.org`)
  arrayAt(object.repositories, `${path}.repositories`).forEach((item, index) => validateRepositorySnapshot(item, `${path}.repositories[${index}]`))
  arrayAt(object.summary, `${path}.summary`).forEach((item, index) => validateSummaryCount(item, `${path}.summary[${index}]`))
  nullable(object.lastMergedPr, `${path}.lastMergedPr`, validateMergedPr)
  optional(object.ciTrend, `${path}.ciTrend`, (nested, nestedPath) => nullable(nested, nestedPath, (items, itemsPath) => {
    arrayAt(items, itemsPath).forEach((item, index) => validateCiTrendBucket(item, `${itemsPath}[${index}]`))
  }))
  optional(object.publicCiTrend, `${path}.publicCiTrend`, (nested, nestedPath) => nullable(nested, nestedPath, (items, itemsPath) => {
    arrayAt(items, itemsPath).forEach((item, index) => validateCiTrendBucket(item, `${itemsPath}[${index}]`))
  }))
}

export function parseDashboardSnapshot(value: unknown): DashboardSnapshot {
  validateDashboardSnapshot(value, '$')
  return value as DashboardSnapshot
}
