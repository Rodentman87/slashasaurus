<div align="center">
  <br />
  <h1>Slashasaurus</h1>
  <br />
  <p>
    <a href="https://discord.gg/hqtbXzry3h"><img src="https://img.shields.io/discord/939038490023301150?color=5865F2&logo=discord&logoColor=white" alt="Discord server" /></a>
    <a href="https://www.npmjs.com/package/slashasaurus"><img src="https://img.shields.io/npm/v/slashasaurus.svg?maxAge=3600" alt="npm version" /></a>
  </p>
</div>

## About

Slashasaurus is a command framework built on top of Discord.js. It's inspired by React and Next.JS, so if you've used either before, this will feel kinda familiar to you.

It is _strongly_ recommended that you use [TypeScript](https://www.typescriptlang.org/) with this library, however, it is not a requirement. The quick start is written in TypeScript, most information should be very similar for vanilla JS.

## Table of Contents

- [Installation](#installation)
- [Latest Changelog](#latest-changelog)
  - [0.1.0](#010)
- [Usage](#usage)
- [Creating your first commands](#creating-your-first-commands)
  - [A Command With Arguments](#a-command-with-arguments)
  - [A Command With Choices](#a-command-with-choices)
  - [A Command With Autocomplete](#a-command-with-autocomplete)
  - [A Command With Subcommands](#a-command-with-subcommands)
  - [Creating a Context Menu Command](#creating-a-context-menu-command)

## Installation

To start a new project with Slashasaurus, you need to install discord.js as well as slashasaurus.

```sh
npm install --save discord.js slashasaurus

# or

yarn add discord.js slashasaurus
```

See [discord.js's readme](https://github.com/discordjs/discord.js#optional-packages) for more info about optional packages.

## Latest Changelog

### 0.1.0

This is the first release of the library, and it is a _beta_ release. Things aren't quite fully done yet and this library still needs to be tested in the wild. I would not recommend porting a large bot to this quite yet. The APIs aren't likely going to get any major changes, but the library internally isn't in a super stable state. Currently it mainly supports slash commands and context menu commands. There's still more planned ahead (especially with message components 👀). There is some extra stuff related to those upcoming features in the library, feel free to take a peek, but they aren't ready quite yet.

## Usage

To start, create your index file and make an instance of the client.

```ts
// index.ts
import { Intents } from 'discord.js';
import path from 'path';
import { SlashasaurusClient } from 'slashasaurus';

const client = new SlashasaurusClient(
  {
    intents: [Intents.FLAGS.GUILDS],
    restRequestTimeout: 30 * 1000,
  },
  {
    devServerId: '561807594516381749',
  }
);
```

The first argument is the same options object you would pass to a discord.js client, [see their docs for more info](https://discord.js.org/#/docs/discord.js/stable/typedef/ClientOptions). The second argument is the options for Slashasaurus. The only required argument is the id of your development server. This is used by the client to register commands to during testing.

Now we need to register our commands with the bot and log in. Don't worry yet about where the commands are, we'll get to that next.

```ts
// index.ts
client.once('ready', () => {
  logger.info(`Client ready and logged in as ${client.user?.tag}`);
  client.registerCommandsFrom(
    path.join(__dirname, '/commands'),
    process.env.NODE_ENV === 'development' ? 'dev' : 'global'
  );
});

client.login(process.env.TOKEN);
```

Once the bot starts up, you'll want to call `client.registerCommandsFrom`. This takes in the path to the folder that contains all your commands as well as how you want the bot to register the commands with discord.

When developing your bot, you can pass "dev" and it will register the commands as guild commands to your development server, that way they update right away.

If your bot is running in production, you can pass "global" and it will register the commands as global commands.

OR

You can pass "none" and this will skip registering the commands with discord, this is especially useful when your bot has multiple shards, that way you wont attempt to register the commands multiple times on startup.

## Creating your first commands

Slashasaurus uses a special folder structure for slash commands that is similar to routes in Next.JS. If you followed the code above, you'll want to put a folder named `commands` in the same location as your index file. Your folders should look something like this

```
my-bot
├─ src
│  ├─ index.ts
│  └─ commands
│
├─ tsconfig.json
├─ README.md
└─ package.json
```

Lets make a generic `ping` slash command first. First, we need to add a folder inside commands named `chat`, this will hold all of our slash commands in it. And add `ping.ts` inside there.

```
my-bot
├─ src
│  ├─ index.ts
│  └─ commands
│     └─ chat
│     	 └─ ping.ts
│
├─ tsconfig.json
├─ README.md
└─ package.json
```

Inside `ping.ts`, we'll write our first SlashCommand. What we need to do is create the command and export it as default.

```ts
// ping.ts
import { SlashCommand } from 'slashasaurus';

export default new SlashCommand(
  {
    name: 'ping',
    description: 'Pings the bot to make sure everything is working',
    options: [],
  },
  {
    run: (interaction) => {
      interaction.reply({
        content: `Pong!`,
        ephemeral: true,
      });
    },
  }
);
```

You'll notice that SlashCommand takes two arguments. The first one is the details of the command: name, description, options, and also the defaultPermissions if you want to specify it. We'll get to the options later as there's some cool stuff there.

The second argument is your handlers, first is the run handler that's called when the command is run. This function receives the [interaction](https://discord.js.org/#/docs/discord.js/stable/class/CommandInteraction), the client, and the options which I'll elaborate on more in a minute. The other handler is the autocomplete handler which will be explained later as well.

### A Command With Arguments

Now that we have a basic command with no arguments, lets make another one to take a look at a command with options.

Create a new file in the `chat` folder named `hello.ts`.

```
my-bot
├─ src
│  ├─ index.ts
│  └─ commands
│     └─ chat
│     	 ├─ hello.ts
│     	 └─ ping.ts
│
├─ tsconfig.json
├─ README.md
└─ package.json
```

In here we'll make a command that asks for the user's name and says hello.

```ts
// hello.ts
import { SlashCommand } from 'slashasaurus';

export default new SlashCommand(
  {
    name: 'hello',
    description: 'Makes the bot greet you',
    options: [
      {
        type: 'STRING',
        name: 'name',
        description: 'Your name',
        required: true,
      },
    ] as const,
  },
  {
    run: (interaction, client, options) => {
      interaction.reply({
        content: `Hello, ${options.name}. Nice to meet you!`,
        ephemeral: true,
      });
    },
  }
);
```

Now you will likely notice something a little weird in here that you probably haven't seen before. What's with this `as const` thing after the options? This does a special thing to the type of the options being passed into the SlashCommand. This is what powers the type of `options`. If you want specifics, you can look at the code here, or ask me about it on Discord. (If you're using JavaScript, it will give you an error on this code. Just remove it, the library will still function perfectly fine)

If we take a look at our handler, we can see that this time we're using the `options` object, and we can get the value of the `name` option by just using `options.name`. The bread and butter of this library (and also what this started as a proof of concept for) is giving you a really easy to work with `options` object. Unlike dealing with a raw CommandInteraction, you don't need to use `getString("name")`, it lives right on the options object, easy to use. If you're using TypeScript you'll also now notice that `options.name` will autocomplete with the correct type. This works for _all_ options types currently available. Just specify the name and type and the library will handle the rest.

### A Command With Choices

Lets take a look at building out a command with a string argument with a provided set of `choices` for the user.

Create a file called `survey.ts` in the same place as last time.

```
my-bot
├─ src
│  ├─ index.ts
│  └─ commands
│     └─ chat
│     	 ├─ hello.ts
│     	 ├─ ping.ts
│     	 └─ survey.ts
│
├─ tsconfig.json
├─ README.md
└─ package.json
```

In there we'll make our new command:

```ts
// survey.ts
import { SlashCommand } from 'slashasaurus';

export default new SlashCommand(
  {
    name: 'survey',
    description: 'Give a response for our survey',
    options: [
      {
        type: 'STRING',
        name: 'language',
        description: 'What language do you use?',
        required: true,
        choices: [
          {
            name: 'JavaScript',
            value: 'js',
          },
          {
            name: 'TypeScript',
            value: 'ts',
          },
        ] as const,
      },
    ] as const,
  },
  {
    run: (interaction, client, options) => {
      if (options.language === 'js') {
        interaction.reply({
          content: `We've recorded your response. (also try TypeScript)`,
          ephemeral: true,
        });
      } else {
        interaction.reply({
          content: `We've recorded your response. (also try JavaScript)`,
          ephemeral: true,
        });
      }
    },
  }
);
```

Again you'll see the `as const` after the array of choices. This does the same thing with the types to help keep the autocomplete helpful. When you look at the type of `options.language` you'll see it's `"js" | "ts"` this means that you'll know exactly what the options are that the user has, instead of needing to remember them or scroll back and check. If you happen to notice that it's just typed as `string` this likely means you forgot the second `as const`.

### A Command With Autocomplete

Before we move on we should take a look at autocomplete options.

Make a new file `longsurvey.ts`:

```
my-bot
├─ src
│  ├─ index.ts
│  └─ commands
│     └─ chat
│     	 ├─ hello.ts
│     	 ├─ ping.ts
│     	 ├─ longsurvey.ts
│     	 └─ survey.ts
│
├─ tsconfig.json
├─ README.md
└─ package.json
```

In here we'll make our command:

```ts
// longsurvey.ts
import { SlashCommand } from 'slashasaurus';

const foods = ['cheese', 'apples', 'oranges', 'burgers', 'bacon', 'fish'];

export default new SlashCommand(
  {
    name: 'longsurvey',
    description: 'Give a response for our other survey',
    options: [
      {
        type: 'STRING',
        name: 'food',
        description: 'Which of these foods is your favorite?',
        required: true,
        autocomplete: true,
      },
    ] as const,
  },
  {
    run: (interaction, client, options) => {
      interaction.reply({
        content: `We've recorded your response of ${options.food}.`,
        ephemeral: true,
      });
    },
    autocomplete: (interaction, focusedName, focusedValue, client, options) => {
      if (focusedName === 'food') {
        interaction.respond(
          foods.filter((food) => food.startsWith(focusedValue))
        );
      }
    },
  }
);
```

Here we have our second handler, `autocomplete`. This handler is given the autocomplete interaction, the name of the field that's being filled out, the value the user has entered so far, the client, and finally the options again. The `focusedName` will only ever be one of the options with autocomplete set to true, so in this case it's type is `"food"`, but if we had another it would be a union of the two, for instance: `"food" | "other"`.

### A Command With Subcommands

Lastly, lets take a look at how we make subcommands. Lets make a `/role add` and a `/role remove`.

First, make a new folder called `role` where you other commands are, then add an `add.ts` and a `remove.ts` inside.

```
my-bot
├─ src
│  ├─ index.ts
│  └─ commands
│     └─ chat
│     	 ├─ hello.ts
│     	 ├─ ping.ts
│     	 ├─ longsurvey.ts
│     	 ├─ role
│        │  ├─ add.ts
│        │  └─ remove.ts
│        │
│     	 └─ survey.ts
│
├─ tsconfig.json
├─ README.md
└─ package.json
```

With this one I won't show the exact commands since that isn't necessary to illusatrate the point. Here you'll see that making subcommands is almost the same as making top level commands. Just place them inside the folder and the top level command will use the folder name as its name. If you want to specify a description for the top level command you can create a file inside the folder named `_meta.ts`. You can export a `description` and `defaultPermissions` to set those on that command. For instance we can make the `_meta.ts` file:

```
my-bot
├─ src
│  ├─ index.ts
│  └─ commands
│     └─ chat
│     	 ├─ hello.ts
│     	 ├─ ping.ts
│     	 ├─ longsurvey.ts
│     	 ├─ role
│        │  ├─ _meta.ts
│        │  ├─ add.ts
│        │  └─ remove.ts
│        │
│     	 └─ survey.ts
│
├─ tsconfig.json
├─ README.md
└─ package.json
```

and put:

```ts
// _meta.ts
export const description = 'Commands for managing your roles';
```

Now our top level `/role` command will have that description.

### Creating a Context Menu Command

Now lets make a quick context menu command to finish off our options. Here we'll need to make a new folder next to our `chat` folder. Let's make a message context menu command that mocks the message.

Create our new folder named `message` and put `mock.ts` in it:

```
my-bot
├─ src
│  ├─ index.ts
│  └─ commands
│     ├─ chat
│     │  ├─ hello.ts
│     │	 ├─ ping.ts
│     │  ├─ longsurvey.ts
│     │	 ├─ role
│     │  │  ├─ _meta.ts
│     │  │  ├─ add.ts
│     │  │  └─ remove.ts
│     │  │
│     │	 └─ survey.ts
│     │
|     └─ message
│        └─ mock.ts
│
├─ tsconfig.json
├─ README.md
└─ package.json
```

In the file we'll make our new context menu command:

```ts
import { MessageCommand } from 'slashasaurus';

export default new MessageCommand(
  {
    name: 'Mock',
  },
  (interaction, _client) => {
    const content = interaction.targetMessage.content;
    interaction.reply({
      content: content
        .split('')
        .map((letter, index) =>
          index % 2 === 0
            ? letter.toLocaleLowerCase()
            : letter.toLocaleUpperCase()
        )
        .join(''),
      ephemeral: true,
    });
  }
);
```

Here we make a MessageCommand and export it as default. All we need to do is give it a name and a run handler and we're all good to go!

That's it for this (admittedly long) "quick" start guide. If you have any further questions, you can ask in the discord server linked at the top of this README.
