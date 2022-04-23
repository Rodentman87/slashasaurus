<div align="center">
  <br />
  <h1>Slashasaurus</h1>
  <br />
  <p>
    <a href="https://discord.gg/hqtbXzry3h"><img src="https://img.shields.io/discord/939038490023301150?color=5865F2&logo=discord&logoColor=white" alt="Discord server" /></a>
    <a href="https://www.npmjs.com/package/slashasaurus"><img src="https://img.shields.io/npm/v/slashasaurus.svg?maxAge=3600" alt="npm version" /></a>
		<a href="https://rodentman87.gitbook.io/slashasaurus/"><img src="https://img.shields.io/badge/docs-lightgrey.svg?maxAge=3600&logo=gitbook" alt="Gitbook" /></a>
  </p>
</div>

## About

Slashasaurus is a command framework built on top of Discord.js. It's inspired by React and Next.JS, so if you've used either before, this will feel kinda familiar to you.

It is _strongly_ recommended that you use [TypeScript](https://www.typescriptlang.org/) with this library, however, it is not a requirement. The quick start is written in TypeScript, most information should be very similar for vanilla JS.

## Table of Contents

- [Installation](#installation)
- [Docs](#docs)
- [Latest Changelogs](#latest-changelogs)
  - [0.4.6](#046)
  - [0.4.5](#045)
  - [0.4.4](#044)
  - [0.4.3](#043)
  - [0.4.2](#042)
  - [0.4.1](#041)
  - [0.4.0](#040)
  - [0.3.0](#030)

## Installation

To start a new project with Slashasaurus, you need to install discord.js as well as slashasaurus.

```sh
npm install --save discord.js slashasaurus

# or

yarn add discord.js slashasaurus
```

See [discord.js's readme](https://github.com/discordjs/discord.js#optional-packages) for more info about optional packages.

## Docs

[View the docs here!](https://rodentman87.gitbook.io/slashasaurus/)

## Latest Changelogs

### 0.4.6

Hopefully the last round of fixes with comparing messages is done. There's lots of little weird quirks with Discord's API that need to be accounted for. This update also updates the message data when a component on an ephemeral Page is used. This allows the Page to be useful beyond the initial 15 minutes of the interaction that triggered the Page.

### 0.4.5

- Add fix for async render functions
- Fix for some issues related to children of `PageActionRow`s

### 0.4.4

- More fixes related to Pages and caching
- Fix for a couple more comparison issues on embeds

### 0.4.3

- A couple small fixes with converting TSX and the `{condition && ...}` syntax

### 0.4.2

- A couple small fixes when detecting whether or not a Page was updated after a reload from persistent storage.
  - Specifically dealing with emoji and labels in buttons and colors in embeds

### 0.4.1

- A couple small fixes when detecting whether or not a Page was updated after a reload from persistent storage.
- Added support for using `{condition && ...}` inside jsx.

### 0.4.0

Added support for specifying an `onAutocomplete` handler for autocomplete args. This allows for easily re-usable autocomplete handlers for things that may be common across multiple commands in your bot.

### 0.3.0

Added TSX support, see the end of the Pages section for details
