import type {Position} from '@yozora/ast'
import * as point from './point'

export function merge(a: Position, b: Position): Position {
  return {
    start: point.min(a.start, b.start),
    end: point.max(a.end, b.end)
  }
}
