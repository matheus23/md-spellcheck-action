import * as fc from 'fast-check'
import type {Position} from '@yozora/ast'
import {expect, test} from '@jest/globals'
import {splitWords} from '../src/spellcheck'

function lookupByPositionOffset(str: string, position: Position) {
  if (position.start.offset == null || position.end.offset == null) {
    throw new Error('Missing offset on position (lookupByPositionOffset)')
  }
  return str.substring(position.start.offset, position.end.offset)
}

function lookupByPositionLineAndColumn(str: string, position: Position) {
  return str.substring(
    lineAndColumnToOffset(str, position.start),
    lineAndColumnToOffset(str, position.end)
  )
}

function lineAndColumnToOffset(str: string, {line, column}: {line: number; column: number}) {
  const newlineMatches = str.matchAll(/\n/g)

  let lastNewlineIndex = -1

  for (let l = 1; l < line; l++) {
    const {value: match} = newlineMatches.next()
    if (match.index != null) {
      lastNewlineIndex = match.index
    }
  }

  return lastNewlineIndex + column
}

function offsetToLineAndColumn(str: string, offset: number): {line: number; column: number} {
  let newlines = 0
  let lastAfterNewlineIndex = 0
  for (const match of str.substring(0, offset).matchAll(/\n/g)) {
    newlines++
    if (match.index != null) {
      lastAfterNewlineIndex = match.index + 1
    }
  }

  const line = newlines + 1
  const column = offset - lastAfterNewlineIndex + 1
  return {line, column}
}


function arbitraryTextOf(arbitrary: fc.Arbitrary<string>) {
  return fc.array(fc.oneof({
    weight: 15,
    arbitrary,
  }, {
    weight: 3,
    arbitrary: fc.constant(' ')
  }, {
    weight: 1,
    arbitrary: fc.constant('\n')
  })).map(pieces => pieces.join(''))
}

test('works on a simple example', () => {
  expect(splitWords('  that\'s some\n\n...text')).toEqual([
    {
      word: 'that\'s',
      position: {
        start: {
          line: 1,
          column: 3,
          offset: 2
        },
        end: {
          line: 1,
          column: 9,
          offset: 8
        }
      }
    }, {
      word: 'some',
      position: {
        start: {
          line: 1,
          column: 10,
          offset: 9
        },
        end: {
          line: 1,
          column: 14,
          offset: 13
        }
      }
    }, {
      word: 'text',
      position: {
        start: {
          line: 3,
          column: 4,
          offset: 18
        },
        end: {
          line: 3,
          column: 8,
          offset: 22
        }
      }
    }
  ])
})


test('property: the split never contains whitespace', () => {
  fc.assert(fc.property(arbitraryTextOf(fc.unicodeString()), str => {
    splitWords(str).forEach(result => {
      expect(result.word.indexOf('\n')).toEqual(-1)
      expect(result.word.indexOf(' ')).toEqual(-1)
    })
  }))
})


test('property: the split position offsets match the text', () => {
  fc.assert(fc.property(arbitraryTextOf(fc.unicodeString()), str => {
    splitWords(str).forEach(result => {
      expect(lookupByPositionOffset(str, result.position)).toEqual(result.word)
    })
  }))
})


test('property: the split position lines and columns match the text', () => {
  fc.assert(fc.property(arbitraryTextOf(fc.unicodeString()), str => {
    const split = splitWords(str)
    const wordsByLookup = split.map(piece => lookupByPositionLineAndColumn(str, piece.position))
    const wordsReturned = split.map(piece => piece.word)
    expect(wordsByLookup).toEqual(wordsReturned)
  }))
})


test('property: the split position start and end lines and columns generate the offset', () => {
  fc.assert(fc.property(arbitraryTextOf(fc.unicodeString()), str => {
    const split = splitWords(str)
    const offsetsFromColumnAndLine = split.map(piece => ({
      start: lineAndColumnToOffset(str, piece.position.start),
      end: lineAndColumnToOffset(str, piece.position.end)
    }))
    const offsetsReturned = split.map(piece => ({
      start: piece.position.start.offset,
      end: piece.position.end.offset
    }))
    expect(offsetsFromColumnAndLine).toEqual(offsetsReturned)
  }))
})


test('property: the split position line and column match the offset', () => {
  fc.assert(fc.property(arbitraryTextOf(fc.unicodeString()), str => {
    const split = splitWords(str)
    const offsetsFromColumnAndLine = split.map(piece => ({
      start: offsetToLineAndColumn(str, piece.position.start.offset || 0),
      end: offsetToLineAndColumn(str, piece.position.end.offset || 0)
    }))
    const offsetsReturned = split.map(piece => ({
      start: {
        line: piece.position.start.line,
        column: piece.position.start.column
      },
      end: {
        line: piece.position.end.line,
        column: piece.position.end.column
      }
    }))
    expect(offsetsFromColumnAndLine).toEqual(offsetsReturned)
  }))
})


test('property: offset to line and column and back roundtrips', () => {
  fc.assert(fc.property(arbitraryTextOf(fc.unicodeString()), str => {
    const offsets = Array.from(Array(str.length).keys())
    const positions = offsets.map(i => offsetToLineAndColumn(str, i))
    const backToOffsets = positions.map(pos => lineAndColumnToOffset(str, pos))
    expect(backToOffsets).toEqual(offsets)
  }))
})
