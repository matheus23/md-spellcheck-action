import * as core from '@actions/core'
import * as glob from '@actions/glob'

import * as ignoreFile from './ignorefile'
import {initialise, Misspelled} from './spellcheck'
import {readFileSync} from 'fs'

async function run(): Promise<void> {
  try {
    const globPattern = core.getInput('files-to-check')
    const excludePattern = core.getInput('files-to-exclude')
    const ignoreFilename = core.getInput('words-to-ignore-file').trim()

    if (globPattern == null || globPattern === '') {
      core.setFailed(
        `Missing configuration field "files-to-check". Please edit your github action workflow.`
      )
      return
    }

    const included = await glob.create(globPattern)
    const isExcluded = await excluder(excludePattern)

    const spell = await initialise()

    const ignores: ignoreFile.IgnoreItem[] = []
    let ignoreMsg: (word: string) => string = () =>
      'If you want to ignore this message, configure an ignore file for md-spellcheck-action.'

    if (ignoreFilename !== '') {
      ignoreMsg = word =>
        `If you want to ignore this message, add ${word} to the ignore file at ${ignoreFilename}`
      const ignoreFileContent = readFileSync(ignoreFilename, {encoding: 'utf8'})
      const ignoreEntries = itMap(
        ignoreFile.parse(ignoreFileContent),
        (ignore: ignoreFile.IgnoreItem) => {
          ignores.push(ignore)
          return ignore
        }
      )

      for (const misspelled of spell.addIgnores(ignoreEntries)) {
        outputMisspelled(
          misspelled,
          ignoreFilename,
          () =>
            "When using '<word> like <word>' syntax in ignore files, the second must be a reference word that's already part of the dictionary."
        )
      }
    }

    if (ignores.length > 0) {
      core.info(`Ignoring words: ${ignores.map(ignore => ignore.word)}`)
    } else {
      core.info(
        `No words to ignore configured: ${
          ignoreFilename === ''
            ? 'No ignore file configured.'
            : 'No words parsed from the ignore file.'
        }`
      )
    }

    let hasMisspelled = false
    let checkedFiles = false

    for await (const file of included.globGenerator()) {
      if (isExcluded(file)) {
        core.info(
          `Ignoring ${file} because it is excluded via 'files-to-exclude'.`
        )
        continue
      }

      checkedFiles = true
      const contents = readFileSync(file, {encoding: 'utf8'})

      for await (const result of spell.check(contents)) {
        hasMisspelled = true

        outputMisspelled(result, file, ignoreMsg)
      }

      core.info(`Spellchecked ${file}.`)
    }

    if (hasMisspelled) {
      core.setFailed('Misspelled word(s)')
    } else if (!checkedFiles) {
      core.setFailed(
        `Couldn't find any files matching the glob pattern ${globPattern}`
      )
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

async function excluder(
  excludePattern: string
): Promise<(filename: string) => boolean> {
  if (excludePattern === '') {
    return () => false
  }

  const exclude = await glob.create(excludePattern)
  const excluded = await exclude.glob()

  return filename => excluded.includes(filename)
}

function outputMisspelled(
  misspelled: Misspelled,
  file: string,
  ignoreMsg: (word: string) => string,
  asWarning = false
): void {
  const suggestions = misspelled.suggestions.map(s => `"${s}"`).join(', ')
  const outputFunc = asWarning ? core.warning : core.error
  outputFunc(
    `Misspelled word "${
      misspelled.word
    }".\nSuggested alternatives: ${suggestions}\n${ignoreMsg(misspelled.word)}`,
    {
      title: 'Misspelled word',
      file,
      startLine: misspelled.position.start.line,
      startColumn: misspelled.position.start.column,
      endLine: misspelled.position.end.line,
      endColumn: misspelled.position.end.column
    }
  )
}

function* itMap<I, O>(iterator: Iterable<I>, f: (input: I) => O): Iterable<O> {
  for (const input of iterator) {
    yield f(input)
  }
}

run()
