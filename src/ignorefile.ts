import * as core from '@actions/core'
import type {Position} from '@yozora/ast'

import * as point from './point'

export interface Word {
  word: string
  position: Position
}

export interface IgnoreItem {
  word: string
  similarTo?: Word
}

export function* parse(content: string): Iterable<IgnoreItem> {
  const lines = content.split('\n')
  let lineNum = 1
  let offset = 0
  for (const line of lines) {
    const commentRemoved = line.replace(/#.*/, '')
    const trimmed = commentRemoved.trim()
    if (trimmed === '') {
      continue
    }
    const split = trimmed.split(/\s+/)
    if (split.length === 1) {
      yield {word: split[0]}
    } else if (split.length === 3 && split[1] === 'like') {
      const lineOffset = line.lastIndexOf(split[2])
      const start = {
        line: lineNum,
        column: lineOffset + 1,
        offset: offset + lineOffset
      }
      const end = point.offset(start, point.end(split[2]))
      const position = {start, end}
      yield {word: split[0], similarTo: {word: split[2], position}}
    } else {
      core.warning(
        `Couldn't parse ignore file entry '${line}' on line ${lineNum}. Expected format: Just a <word> or '<word> like <word>'`
      )
    }
    offset += line.length + 1 // 1 for the newline
    lineNum++
  }
}
