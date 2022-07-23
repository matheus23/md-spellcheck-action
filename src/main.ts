import * as core from '@actions/core'
import {initialise} from './spellcheck'
import {readFileSync} from 'fs'

async function run(): Promise<void> {
  try {
    // const ms: string = core.getInput('milliseconds')

    const spell = await initialise()

    const file = './README.md'
    const contents = readFileSync(file, {encoding: 'utf8'})

    let failed = false
    for await (const result of spell.check(contents)) {
      failed = true
      if (result.position == null) {
        throw new Error('Missing position spans')
      } else {
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
    }

    if (failed) {
      core.setFailed('Misspelled word(s)')
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
