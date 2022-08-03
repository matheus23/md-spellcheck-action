// import * as core from '@actions/core'
import type {Literal, Node, Parent, Point, Position, Link} from '@yozora/ast'
import {GfmExParser} from '@yozora/parser-gfm-ex'
import {MathTokenizer} from '@yozora/tokenizer-math'
import {InlineMathTokenizer} from '@yozora/tokenizer-inline-math'
import dictionaryEn from 'dictionary-en'
import {loadModule} from 'hunspell-asm'

import * as point from './point'
import * as positions from './positions'

export const WORD_REGEX =
  /[\wABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýÿ'-]+/g

export const SKIP_TYPES = ['inlineCode', 'inlineMath']
export const BLOCK_TYPES = [
  'paragraph',
  'blockquote',
  'definition',
  'footnote',
  'footnoteDefinition',
  'heading',
  'table'
]

export interface Word {
  word: string
  position: Position
}

export interface Misspelled extends Word {
  suggestions: string[]
}

export interface API {
  // eslint-disable-next-line no-undef
  check(contents: string): AsyncIterable<Misspelled>
}

export async function initialise(
  ignoreList?: Iterable<{word: string; similarTo?: string}>
): Promise<API> {
  const {aff, dic} = await getDictionaryEN()
  const hunspellFactory = await loadModule()
  const affPath = hunspellFactory.mountBuffer(aff)
  const dicPath = hunspellFactory.mountBuffer(dic)
  const hunspell = hunspellFactory.create(affPath, dicPath)

  if (ignoreList != null) {
    for (const ignored of ignoreList) {
      if (ignored.similarTo != null) {
        hunspell.addWordWithAffix(ignored.word, ignored.similarTo)
      } else {
        hunspell.addWord(ignored.word)
      }
    }
  }

  return {
    check: async function* check(contents: string) {
      const parser = new GfmExParser()
      parser.useTokenizer(new MathTokenizer())
      parser.useTokenizer(new InlineMathTokenizer({backtickRequired: false}))
      parser.setDefaultParseOptions({shouldReservePosition: true})
      const parsed = parser.parse(contents)

      for (const block of markdownBlocks(parsed)) {
        for (const {word, position} of mergedWords(markdownTokens(block))) {
          if (!hunspell.spell(word)) {
            yield {
              word,
              position,
              suggestions: hunspell.suggest(word)
            }
          }
        }
      }
    }
  }
}

function* markdownBlocks(node: Node): Iterable<Node> {
  if (BLOCK_TYPES.includes(node.type)) {
    yield node
  } else if (isParent(node)) {
    for (const child of node.children) {
      yield* markdownBlocks(child)
    }
  }
}

function* markdownTokens(node: Node): Iterable<PositionedToken> {
  for (const literal of textNodes(node)) {
    yield* literalPositionedTokens(literal)
  }
}

function* textNodes(node: Node): Iterable<Literal> {
  if (SKIP_TYPES.includes(node.type)) {
    return
  }

  if (isText(node)) {
    yield node
  } else if (isLink(node)) {
    const text = innerText(node)
    if (text === node.url) {
      return // skip this node
    }
  } else if (isParent(node)) {
    for (const child of node.children) {
      yield* textNodes(child)
    }
  }
}

function innerText(node: Parent): string {
  return node.children
    .map(child =>
      isText(child) ? child.value : isParent(child) ? innerText(child) : ''
    )
    .join('')
}

function* literalPositionedTokens(node: Literal): Iterable<PositionedToken> {
  if (node.position == null) {
    throw new Error('Missing position spans')
  }

  let start = node.position.start

  for (const token of wordsAndWhitespace(node.value)) {
    const end = point.offset(start, point.end(token.content))

    yield {
      ...token,
      position: {start, end}
    }

    start = end
  }
}

interface Token {
  type: 'word' | 'whitespace'
  content: string
}

interface PositionedToken extends Token {
  position: Position
}

function* wordsAndWhitespace(str: string): Iterable<Token> {
  let lastEnd = 0
  for (const match of str.matchAll(WORD_REGEX)) {
    if (match.index == null) {
      throw new Error(`Regex match went wrong. No index? ${match}`)
    }

    const word = match[0]

    if (match.index !== 0 && lastEnd !== match.index) {
      yield {
        type: 'whitespace',
        content: str.substring(lastEnd, match.index)
      }
    }

    yield {
      type: 'word',
      content: word
    }

    lastEnd = match.index + word.length
  }

  if (lastEnd !== str.length) {
    yield {
      type: 'whitespace',
      content: str.substring(lastEnd, str.length)
    }
  }
}

function* mergedWords(tokens: Iterable<PositionedToken>): Iterable<Word> {
  let currentWord: null | Word = null

  for (const token of tokens) {
    // current word begins
    if (currentWord == null && token.type === 'word') {
      currentWord = {
        word: token.content,
        position: token.position
      }
      // continuing the current word
    } else if (currentWord != null && token.type === 'word') {
      currentWord = {
        word: `${currentWord.word}${token.content}`,
        position: positions.merge(currentWord.position, token.position)
      }
      // current word ended
    } else if (currentWord != null && token.type === 'whitespace') {
      yield currentWord
      currentWord = null
    }
  }

  if (currentWord != null) {
    yield currentWord
  }
}

export function* splitWords(str: string): Iterable<Word> {
  let start: Point = {
    line: 1,
    column: 1,
    offset: 0
  }

  for (const item of wordsAndWhitespace(str)) {
    const end = point.offset(start, point.end(item.content))
    if (item.type === 'word') {
      yield {
        word: item.content,
        position: {start, end}
      }
    }
    start = end
  }
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

function isLink(obj: Node): obj is Link {
  return obj.type === 'link'
}

function isParent(obj: Node): obj is Parent<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Array.isArray((obj as unknown as any).children)
}
