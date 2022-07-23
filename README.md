# md-spellcheck-action

> Spellcheck markdown files in your GitHub action

Uses [hunspell](http://hunspell.github.io/)'s code (complied to WASM) and English dictionary.

Only tests markdown files specified in a glob pattern and ignores any code fragments in markdown.

You can add words to an ignore list by providing a path to a newline-separated text file of words to ignore.

## Usage

```yml
name: 'spellcheck'
on:
  pull_request:
  push:

jobs:
  spellcheck:
    runs-on: ubuntu-latest
    steps:
      - uses: matheus23/md-spellcheck-action@v1.0.1
        with:
          files-to-check: "*.md"
          words-to-ignore-file: ./words-to-ignore.txt
```
