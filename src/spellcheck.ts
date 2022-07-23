// import * as core from '@actions/core'
import type {Literal, Node, Parent, Position} from '@yozora/ast'
import {GfmExParser} from '@yozora/parser-gfm-ex'
import dictionaryEn from 'dictionary-en'
import {loadModule} from 'hunspell-asm'

export interface CheckResult {
  position?: Position
  word: string
  suggestions: string[]
}

export interface API {
  check(contents: string): AsyncIterable<CheckResult>
}

export async function initialise(): Promise<API> {
  // const before = performance.now()

  const {aff, dic} = await getDictionaryEN()
  const hunspellFactory = await loadModule()
  const affPath = hunspellFactory.mountBuffer(aff)
  const dicPath = hunspellFactory.mountBuffer(dic)
  const hunspell = hunspellFactory.create(affPath, dicPath)

  // core.debug(`time: ${performance.now() - before} ms`)

  return {
    check: async function* check(contents: string) {
      const parser = new GfmExParser()
      parser.setDefaultParseOptions({shouldReservePosition: true})
      const parsed = parser.parse(contents)

      const nodeStack: Parent<string>[] = [parsed]
      while (nodeStack.length > 0) {
        const node = nodeStack.pop()
        // types...
        if (node == null) {
          break
        }

        for (const child of node.children) {
          if (isText(child)) {
            const words = child.value.split(/\s+/).filter(w => w.length !== 0)
            for (const word of words) {
              if (!hunspell.spell(word)) {
                yield {
                  position: child.position,
                  word,
                  suggestions: hunspell.suggest(word)
                }
              }
            }
          } else if (isParent(child)) {
            const skipTypes = [
              'ecmaImport',
              'code',
              'inlineCode',
              'math',
              'inlineMath',
              'html',
              'frontmatter',
              'link',
              'linkReference',
              'image',
              'imageReference',
              'footnote',
              'footnoteReference',
              'footnoteDefinition'
            ]
            if (!skipTypes.includes(child.type)) {
              nodeStack.push(child)
            }
          }
        }
      }
    }
  }
}

export function splitWords(str: string): {word: string; position: Position}[] {
  const pieces: {word: string; position: Position}[] = []

  let linesOffset = 0
  let line = 1

  for (const lineInStr of str.split('\n')) {
    for (const match of lineInStr.matchAll(/[\w']+/g)) {
      if (match.index == null) {
        throw new Error(`Regex match went wrong. No index? ${match}`)
      }

      const word = match[0]
      const offset = linesOffset + match.index
      const column = match.index + 1

      pieces.push({
        word,
        position: {
          start: {
            line,
            column,
            offset
          },
          end: {
            line,
            column: column + word.length,
            offset: offset + word.length
          }
        }
      })
    }

    linesOffset += lineInStr.length + 1 // +1 for the newline
    line++
  }

  return pieces
}

// export function splitWords(str: string): {word: string; position: Position}[] {
//   let line = 1
//   let column = 1

//   let lastEndOfWord = 0

//   const pieces: {word: string; position: Position}[] = []

//   for (const match of str.matchAll(/[\w']+/g)) {
//     if (match.index == null) {
//       throw new Error(`Regex match went wrong. No index? ${match}`)
//     }

//     const word = match[0]
//     const whitespace = str.substring(lastEndOfWord, match.index)
//     let whitespaceHasNewline = false

//     for (const newline of whitespace.matchAll(/\n/g)) {
//       if (newline.index == null) {
//         throw new Error(`Regex match went wrong. No index? ${newline}`)
//       }

//       line++
//       column = match.index - newline.index + 1
//       whitespaceHasNewline = true
//     }

//     if (!whitespaceHasNewline) {
//       column += whitespace.length
//     }

//     pieces.push({
//       word,
//       position: {
//         start: {
//           line,
//           column,
//           offset: match.index
//         },
//         end: {
//           line,
//           column: column + word.length,
//           offset: match.index + word.length
//         }
//       }
//     })

//     column += word.length
//     lastEndOfWord = match.index + word.length
//   }

//   return pieces
// }

// export function splitWords(str: string): {word: string; position: Position}[] {
//   let line = 1
//   let column = 1
//   let offset = 0

//   const pieces: {word: string; position: Position}[] = []
//   let word = ''
//   let startLine = line
//   let startColumn = column
//   let startOffset = offset
//   let inWord = true

//   for (const letter of str) {
//     if (letter.match(/\s/)) {
//       if (inWord && word.length > 0) {
//         pieces.push({
//           word,
//           position: {
//             start: {
//               line: startLine,
//               column: startColumn,
//               offset: startOffset
//             },
//             end: {
//               line,
//               column,
//               offset
//             }
//           }
//         })
//       }

//       if (letter === '\n') {
//         line++
//         column = 1
//       } else {
//         column++
//       }

//       inWord = false
//     } else {
//       if (!inWord) {
//         startLine = line
//         startColumn = column
//         startOffset = offset
//       }

//       word += letter

//       inWord = true
//     }

//     offset++
//   }

//   return pieces
// }

// export function splitWords(str: string): {word: string; position: Position}[] {
//   let line = 1
//   let column = 1
//   let offset = 0

//   const pieces: {word: string; position: Position}[] = []

//   for (const match of str.matchAll(/\s+/g)) {
//     const whitespace = match[0]

//     let newlines = 0
//     let lastNewlineIndex = 0
//     for (const newline of whitespace.matchAll(/\n/g)) {
//       newlines++
//       lastNewlineIndex = newline.index ? newline.index : lastNewlineIndex
//     }

//     if (match.index == null) {
//       throw new Error(`Expected an index property on regexp match: ${match}`)
//     }

//     if (match.index !== 0) {
//       const word = str.substring(offset, match.index)

//       pieces.push({
//         word,
//         position: {
//           start: {
//             offset,
//             line,
//             column
//           },
//           end: {
//             offset: match.index,
//             line: line + newlines,
//             column: column + word.length
//           }
//         }
//       })
//     }

//     line += newlines
//     column =
//       newlines > 0
//         ? whitespace.length - (lastNewlineIndex + 1)
//         : column + whitespace.length

//     offset = match.index + whitespace.length
//   }

//   return pieces
// }

async function getDictionaryEN(): Promise<{aff: Buffer; dic: Buffer}> {
  return new Promise((resolve, reject) => {
    try {
      dictionaryEn((error, dicts) => (error ? reject(error) : resolve(dicts)))
    } catch (e) {
      reject(e)
    }
  })
}

function isText(obj: Node): obj is Literal {
  return obj.type === 'text'
}

function isParent(obj: Node): obj is Parent<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Array.isArray((obj as unknown as any).children)
}
