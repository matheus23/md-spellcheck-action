# md-spellcheck-action

> Spellcheck markdown files in your GitHub action

Uses [Hunspell](http://hunspell.github.io/)'s code (complied to WASM) and English dictionary.

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
      - uses: actions/checkout@v3
      - uses: matheus23/md-spellcheck-action@v4.2.0
        with:
          files-to-check: "*.md"
          files-to-exclude: "LICENSE.md" # optional
          words-to-ignore-file: ./words-to-ignore.txt
```

## Ignored Words

The spellcheck action ignores all words within `code spans` and code blocks.

Additionally ignored words can be configured using a `words-to-ignore-file` (configure `md-spellcheck-action` to pick that file up as shown above).
This ignore file has following syntax:

```ini
# Anything after a # is a comment
utopiculous # ignore a word by writing it here. Capitalization matters
# You can provide words that are similar to the word you ignore in order
# for hunspell to detect variations of the word and ignore it as well
# (e.g. plural forms, prefixes, etc.)
extradicious like delicious
```
