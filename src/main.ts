import * as core from '@actions/core'
import * as glob from '@actions/glob'
import {initialise} from './spellcheck'
import {readFileSync} from 'fs'

async function run(): Promise<void> {
  try {
    const globPattern = core.getInput('files-to-check')
    const excludePattern = core.getInput('files-to-exclude')
    const ignoreFile = core.getInput('words-to-ignore-file').trim()

    if (globPattern == null || globPattern === '') {
      core.setFailed(
        `Missing configuration field "files-to-check". Please edit your github action workflow.`
      )
      return
    }

    const included = await glob.create(globPattern)
    const isExcluded = await excluder(excludePattern)

    const ignores: {word: string; similarTo?: string}[] = []
    let ignoreMsg: (word: string) => string = () =>
      'If you want to ignore this message, configure an ignore file for md-spellcheck-action.'

    if (ignoreFile !== '') {
      ignoreMsg = word =>
        `If you want to ignore this message, add ${word} to the ignore file at ${ignoreFile}`
      const ignoreEntries = readFileSync(ignoreFile, {encoding: 'utf8'}).split(
        '\n'
      )

      let line = 1
      for (const entry of ignoreEntries) {
        const commentRemoved = entry.replace(/#.*/, '')
        const trimmed = commentRemoved.trim()
        if (trimmed === '') {
          continue
        }
        const split = trimmed.split(/\s+/)
        if (split.length === 1) {
          ignores.push({word: split[0]})
        } else if (split.length === 3 && split[1] === 'like') {
          ignores.push({word: split[0], similarTo: split[2]})
        } else {
          core.warning(
            `Couldn't parse ignore file entry '${entry}' on line ${line}. Expected format: Just a <word> or '<word> like <word>'`
          )
        }
        line++
      }
    }

    if (ignores.length > 0) {
      core.info(`Ignoring words: ${ignores.map(ignore => ignore.word)}`)
    } else {
      core.info(
        `No words to ignore configured: ${
          ignoreFile === ''
            ? 'No ignore file configured.'
            : 'No words parsed from the ignore file.'
        }`
      )
    }

    let hasMisspelled = false
    let checkedFiles = false

    const spell = await initialise(ignores)

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

        const suggestions = result.suggestions.map(s => `"${s}"`).join(', ')
        core.error(
          `Misspelled word "${
            result.word
          }".\nSuggested alternatives: ${suggestions}\n${ignoreMsg(
            result.word
          )}`,
          {
            title: 'Misspelled word',
            file,
            startLine: result.position.start.line,
            startColumn: result.position.start.column,
            endLine: result.position.end.line,
            endColumn: result.position.end.column
          }
        )
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

run()
