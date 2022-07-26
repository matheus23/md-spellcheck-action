import {expect, test} from '@jest/globals'
import {initialise, Misspelled} from '../src/spellcheck'

test('detects misspelled words', async () => {
  const api = await initialise()
  const errors = await all(api.check('mispeled\nwoords'))
  expect(errors.length).toEqual(2)
})

test('has error spans', async () => {
  const api = await initialise()
  const errors = await all(api.check('mispeled\nwoords wat'))
  expect(errors[0]?.position?.start?.line).toEqual(1)
  expect(errors[0]?.position?.start?.column).toEqual(1)
  expect(errors[1]?.position?.start?.line).toEqual(2)
  expect(errors[1]?.position?.start?.column).toEqual(1)
  expect(errors[2]?.position?.start?.line).toEqual(2)
  expect(errors[2]?.position?.start?.column).toEqual(8)
})

test('can handle non-ascii', async () => {
  const api = await initialise()
  const errors: Misspelled[] = []
  for await (const error of api.check("yoar's")) {
    errors.push(error)
  }
  expect(errors.length).toEqual(1)
})

test('allow hyphens within words', async () => {
  const api = await initialise()
  const errors = await all(api.check('sozio-ekonomic'))
  expect(errors.length).toEqual(1)
})

test('handle broken-up-by-markup words', async () => {
  const api = await initialise()
  const errors = await all(api.check('**Ama**zing'))
  expect(errors).toEqual([])
})

test('handle broken-up-by-link words', async () => {
  const api = await initialise()
  const errors = await all(
    api.check(`Uses [Hunspell](http://hunspell.github.io/)'s code`)
  )
  expect(errors).toEqual([])
})

test('correctly doesnt merge tokens', async () => {
  const api = await initialise()
  const errors = await all(
    api.check(`> - CK: content key
> - Yellow lines`)
  )
  expect(errors).toEqual([])
})

test('correctly recognizes apostrophes', async () => {
  const api = await initialise()
  const errors = await all(api.check(`don't tell me this doesn't work`))
  expect(errors).toEqual([])
})

test('correctly allows apostrophes as quotes', async () => {
  const api = await initialise()
  const errors = await all(api.check(`it refers to a 'normalized function'`))
  expect(errors).toEqual([])
})

test('ignores urls', async () => {
  const api = await initialise()
  const errors = await all(
    api.check(`*The text of this Community Specification License is Copyright 2020 Joint Development Foundation
and is licensed under the Creative Commons Attribution 4.0
International License available at https://creativecommons.org/licenses/by/4.0/.*`)
  )
  expect(errors.map(misspelled => misspelled.word)).toEqual([])
})

test('ignores math', async () => {
  const api = await initialise()
  const errors = await all(
    api.check(`$$eqwations dont need spellcheck$$
    
    but real text needs it.`)
  )
  expect(errors.map(misspelled => misspelled.word)).toEqual([])
})

test('ignores inline math', async () => {
  const api = await initialise()
  const errors = await all(api.check(`This is a $misssspelled$ math word.`))
  expect(errors.map(misspelled => misspelled.word)).toEqual([])
})

async function all<T>(gen: AsyncIterable<T>): Promise<T[]> {
  const ts: T[] = []
  for await (const t of gen) {
    ts.push(t)
  }
  return ts
}
