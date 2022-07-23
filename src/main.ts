import * as core from '@actions/core'
import * as glob from '@actions/glob'
import {initialise} from './spellcheck'
import {readFileSync} from 'fs'

async function run(): Promise<void> {
  try {
    const spell = await initialise()

    const globPattern = core.getInput('files-to-check')
    const ignoreFile = core.getInput('words-to-ignore-file').trim()

    if (globPattern == null) {
      core.setFailed(
        `Missing configuration field "files-to-check". Please edit your github action workflow.`
      )
      return
    }

    const globs = await glob.create(globPattern)

    const ignores = new Set<string>()
    let ignoreMsg: (word: string) => string = () =>
      'If you want to ignore this message, configure an ignore file for md-spellcheck-action.'

    if (ignoreFile !== '') {
      ignoreMsg = word =>
        `If you want to ignore this message, add ${word} to the ignore file at ${ignoreFile}`
      const ignoreEntries = readFileSync(ignoreFile, {encoding: 'utf8'}).split(
        '\n'
      )

      for (const entry of ignoreEntries) {
        ignores.add(entry.trim().toLowerCase())
      }
    }

    if (ignores.size > 0) {
      core.info(`Ignoring words: ${Array.from(ignores)}`)
    } else {
      core.info(
        `No words to ignore configured: ${
          ignoreFile === ''
            ? 'No ignore file configured.'
            : 'No words in the ignore file.'
        }`
      )
    }

    let hasMisspelled = false
    let checkedFiles = false

    for await (const file of globs.globGenerator()) {
      checkedFiles = true
      const contents = readFileSync(file, {encoding: 'utf8'})

      for await (const result of spell.check(contents)) {
        if (ignores.has(result.word.toLowerCase())) {
          continue
        }

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

run()
