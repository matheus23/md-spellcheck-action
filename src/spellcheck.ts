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