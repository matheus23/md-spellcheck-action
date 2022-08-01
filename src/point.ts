import type {Point} from '@yozora/ast'

export function end(str: string): Point {
  let line = 1
  let lastNewlineOffset = -1

  for (const match of str.matchAll(/\n/g)) {
    if (match.index == null) {
      throw new Error(`Regex match went wrong. No index? ${match}`)
    }

    line++
    lastNewlineOffset = match.index
  }

  return {
    line,
    column: str.length - lastNewlineOffset,
    offset: str.length
  }
}

export function offset(point: Point, relativeOffset: Point): Point {
  const line0 = point.line - 1
  const column0 = point.column - 1

  return {
    line: relativeOffset.line + line0,
    column:
      relativeOffset.line === 1
        ? relativeOffset.column + column0
        : relativeOffset.column,
    offset:
      relativeOffset.offset != null && point.offset != null
        ? relativeOffset.offset + point.offset
        : undefined
  }
}

export function min(a: Point, b: Point): Point {
  if (a.offset && b.offset) {
    return a.offset < b.offset ? a : b
  }
  if (a.line === b.line) {
    return a.column < b.column ? a : b
  }
  return a.line < b.line ? a : b
}

export function max(a: Point, b: Point): Point {
  if (a.offset && b.offset) {
    return a.offset > b.offset ? a : b
  }
  if (a.line === b.line) {
    return a.column > b.column ? a : b
  }
  return a.line > b.line ? a : b
}
