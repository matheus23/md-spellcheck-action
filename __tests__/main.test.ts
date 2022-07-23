// import * as process from 'process'
import {expect, test} from '@jest/globals'
import {Misspelled, initialise} from '../src/spellcheck'

test('detects misspelled words', async () => {
  const api = await initialise()
  const errors = []
  for await (const error of api.check('mispeled\nwoords')) {
    errors.push(error)
  }
  expect(errors.length).toEqual(2)
})

test('has error spans', async () => {
  const api = await initialise()
  const errors: Misspelled[] = []
  for await (const error of api.check('mispeled\nwoords wat')) {
    errors.push(error)
  }
  expect(errors[0]?.position?.start?.line).toEqual(1)
  expect(errors[0]?.position?.start?.column).toEqual(1)
  expect(errors[1]?.position?.start?.line).toEqual(2)
  expect(errors[1]?.position?.start?.column).toEqual(1)
  expect(errors[2]?.position?.start?.line).toEqual(2)
  expect(errors[2]?.position?.start?.column).toEqual(8)
})

test('can handle non-ascii', async () => {
  const api = await initialise()
  const errors = []
  for await (const error of api.check("yoar's")) {
    errors.push(error)
  }
  expect(errors.length).toEqual(1)
})

// // shows how the runner will run a javascript action with env / stdout protocol
// test('test runs', () => {
//   process.env['INPUT_MILLISECONDS'] = '500'
//   const np = process.execPath
//   const ip = path.join(__dirname, '..', 'lib', 'main.js')
//   const options: cp.ExecFileSyncOptions = {
//     env: process.env
//   }
//   console.log(cp.execFileSync(np, [ip], options).toString())
// })
