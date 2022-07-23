import * as core from '@actions/core'
import * as glob from '@actions/glob'
import {initialise} from './spellcheck'
import {readFileSync} from 'fs'

async function run(): Promise<void> {
  try {
    const spell = await initialise()

    const globs = await glob.create(core.getInput('files-to-check'))

    for await (const file of globs.globGenerator()) {
      const contents = readFileSync(file, {encoding: 'utf8'})

      let hasMisspelled = false
      for await (const result of spell.check(contents)) {
        hasMisspelled = true

        const suggestions = result.suggestions.map(s => `"${s}"`).join(', ')
        core.error(
          `Misspelled word "${result.word}".\nSuggestions: ${suggestions}`,
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

      if (hasMisspelled) {
        core.setFailed('Misspelled word(s)')
      }
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
