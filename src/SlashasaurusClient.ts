import {
  ApplicationCommandData,
  ApplicationCommandManager,
  ApplicationCommandOptionData,
  AutocompleteInteraction,
  Awaitable,
  BaseCommandInteraction,
  ButtonInteraction,
  Client,
  ClientEvents,
  ClientOptions,
  CommandInteraction,
  ContextMenuInteraction,
  GuildApplicationCommandManager,
  Interaction,
  Message,
  MessageComponentInteraction,
  SelectMenuInteraction,
  TextBasedChannel,
} from 'discord.js';
import { join } from 'path';
import { readdir, stat } from 'fs/promises';
import {
  ContextMenuHandlerType,
  isMessageCommand,
  isUserCommand,
  MessageCommand,
  UserCommand,
} from './ContextMenuBase';
import { Pipeline, Middleware } from './MiddlewarePipeline';
import { Page, pageComponentRowsToComponents } from './Page';
import {
  SlashCommand,
  CommandRunFunction,
  AutocompleteFunction,
  isChatCommand,
} from './SlashCommandBase';

interface SlashasaurusClientEvents extends ClientEvents {
  commandRun: [intercation: CommandInteraction];
  buttonPressed: [interaction: ButtonInteraction];
  selectChanged: [interaction: SelectMenuInteraction];
  contextMenuRun: [interaction: ContextMenuInteraction];
  autocomplete: [interaction: AutocompleteInteraction];
}

const JSFileRegex = /(\.js|\.ts)x?$/;

export declare interface SlashasaurusClient extends Client<true> {
  on<K extends keyof SlashasaurusClientEvents>(
    event: K,
    listener: (...args: SlashasaurusClientEvents[K]) => Awaitable<void>
  ): this;

  once<K extends keyof SlashasaurusClientEvents>(
    event: K,
    listener: (...args: SlashasaurusClientEvents[K]) => Awaitable<void>
  ): this;

  emit<K extends keyof SlashasaurusClientEvents>(
    event: K,
    ...args: SlashasaurusClientEvents[K]
  ): boolean;

  off<K extends keyof SlashasaurusClientEvents>(
    event: K,
    listener: (...args: SlashasaurusClientEvents[K]) => Awaitable<void>
  ): this;

  removeAllListeners<K extends keyof SlashasaurusClientEvents>(event?: K): this;
}

export interface SlashasaurusClientOptions {
  /**
   * You can pass any logger compatible with [pino](https://getpino.io/)
   * and the client will log some internal information to it
   */
  logger?: Logger;

  /**
   * This will be used to register guild commands when running the bot
   * in development
   */
  devServerId: string;
}

interface LogFn {
  <T extends object>(obj: T, msg?: string, ...args: any[]): void;
  (msg: string, ...args: any[]): void;
}

export interface Logger {
  info: LogFn;
  debug: LogFn;
  error: LogFn;
}

interface PageCacheValue {
  page: Page;
  message: Message | MessageComponentInteraction | BaseCommandInteraction;
}

// TODO: Figure out page state serialization in case a message needs to leave cache or the bot shuts down suddenly
// - I need a page registry for recreating a page during deserialization
// - I need to serialize the page state the first time it is sent
// - I need to update that saved state when setState is called
// - I need to setup cache sweeping for the pages
// - I need to make a serialization function
// - I need to make a de-serialization function
// If I just serialize the page's state and props then I don't need to bother with serializing handlers
export class SlashasaurusClient extends Client<true> {
  commandMap = new Map<string, SlashCommand<any>>();
  userContextMenuMap = new Map<string, UserCommand>();
  messageContextMenuMap = new Map<string, MessageCommand>();
  logger?: Logger;
  devServerId: string;
  chatCommandMiddleware: Pipeline<CommandRunFunction<[]>>;
  autocompleteMiddleware: Pipeline<AutocompleteFunction<[]>>;
  contextMenuMiddleware: Pipeline<
    ContextMenuHandlerType<'MESSAGE'> | ContextMenuHandlerType<'USER'>
  >;

  activePages: Map<string, PageCacheValue>;

  constructor(djsOptions: ClientOptions, options: SlashasaurusClientOptions) {
    super(djsOptions);
    this.logger = options.logger;
    this.devServerId = options.devServerId;
    this.on('interactionCreate', this.handleInteractionEvent);
    this.chatCommandMiddleware = new Pipeline();
    this.autocompleteMiddleware = new Pipeline();
    this.contextMenuMiddleware = new Pipeline();
    this.activePages = new Map();
  }

  /**
   * Registers all command files in the given path
   *
   * @param folderPath The relative path to the folder
   */
  // TODO: and also guild specific commands
  // guild commands will be a 0.2 thing probably tbh
  async registerCommandsFrom(
    folderPath: string,
    registerTo: 'global' | 'dev' | 'none'
  ) {
    this.logger?.info('Registering commands');
    const topLevelFolders = await readdir(folderPath);

    const commandData: ApplicationCommandData[] = [];

    for (const folderName of topLevelFolders) {
      switch (folderName) {
        case 'chat':
          commandData.push(
            ...(await this.loadTopLevelCommands(join(folderPath, folderName)))
          );
          break;
        case 'message':
          commandData.push(
            ...(await this.loadMessageCommands(join(folderPath, folderName)))
          );
          break;
        case 'user':
          commandData.push(
            ...(await this.loadUserCommands(join(folderPath, folderName)))
          );
          break;
      }
    }

    this.logger?.debug(commandData);

    let manager: ApplicationCommandManager | GuildApplicationCommandManager;
    if (registerTo === 'dev') {
      manager = this.guilds.cache.get(this.devServerId)!.commands;
      manager.set(commandData);
    } else if (registerTo === 'global') {
      manager = this.application!.commands;
      manager.set(commandData);
    }

    this.logger?.info('Finished registering commands');
  }

  useCommandMiddleware(fn: Middleware<CommandRunFunction<[]>>) {
    this.chatCommandMiddleware.push(fn);
  }

  useAutocompleteMiddleware(fn: Middleware<AutocompleteFunction<[]>>) {
    this.autocompleteMiddleware.push(fn);
  }

  useContextMenuMiddleware(
    fn: Middleware<
      ContextMenuHandlerType<'MESSAGE'> | ContextMenuHandlerType<'USER'>
    >
  ) {
    this.contextMenuMiddleware.push(fn);
  }

  private async loadUserCommands(path: string) {
    const topLevel = await readdir(path);

    const commandData: ApplicationCommandData[] = [];

    for (const folderOrFile of topLevel) {
      const filePath = join(path, folderOrFile);
      if ((await stat(filePath)).isFile()) {
        if (folderOrFile.match(JSFileRegex)) {
          // This is a js file
          const data = await import(filePath);
          if (!data.default) {
            throw new Error(
              `Expected a default export in file ${join(
                path,
                folderOrFile
              )} but didn't find one`
            );
          }
          const command = data.default;
          if (!isUserCommand(command)) {
            throw new Error(
              `Expected the default export in file ${join(
                path,
                folderOrFile
              )} to be a UserCommand`
            );
          }
          this.userContextMenuMap.set(command.commandInfo.name, command);
          commandData.push(command.commandInfo);
        }
      } else {
        throw new Error('');
      }
    }

    return commandData;
  }

  private async loadMessageCommands(path: string) {
    const topLevel = await readdir(path);

    const commandData: ApplicationCommandData[] = [];

    for (const folderOrFile of topLevel) {
      const filePath = join(path, folderOrFile);
      if ((await stat(filePath)).isFile()) {
        if (folderOrFile.match(JSFileRegex)) {
          // This is a js file
          const data = await import(filePath);
          if (!data.default) {
            throw new Error(
              `Expected a default export in file ${join(
                path,
                folderOrFile
              )} but didn't find one`
            );
          }
          const command = data.default;
          if (!isMessageCommand(command)) {
            throw new Error(
              `Expected the default export in file ${join(
                path,
                folderOrFile
              )} to be a MessageCommand`
            );
          }
          this.messageContextMenuMap.set(command.commandInfo.name, command);
          commandData.push(command.commandInfo);
        }
      } else {
        throw new Error('');
      }
    }

    return commandData;
  }

  private async loadTopLevelCommands(path: string) {
    const topLevel = await readdir(path);

    const commandData: ApplicationCommandData[] = [];

    for (const folderOrFile of topLevel) {
      const filePath = join(path, folderOrFile);
      if ((await stat(filePath)).isFile()) {
        if (folderOrFile.match(JSFileRegex)) {
          // This is a js file
          const data = await import(filePath);
          if (!data.default) {
            throw new Error(
              `Expected a default export in file ${join(
                path,
                folderOrFile
              )} but didn't find one`
            );
          }
          const command = data.default;
          if (!isChatCommand(command)) {
            throw new Error(
              `Expected the default export in file ${join(
                path,
                folderOrFile
              )} to be a SlashCommand`
            );
          }
          this.commandMap.set(command.commandInfo.name, command);
          commandData.push(command.commandInfo);
        }
      } else {
        // This has subcommands
        commandData.push(
          await this.loadSubFolderLevelOne(filePath, folderOrFile)
        );
      }
    }

    return commandData;
  }

  private async loadSubFolderLevelOne(
    path: string,
    name: string
  ): Promise<ApplicationCommandData> {
    const topLevel = await readdir(path);

    const commandData: ApplicationCommandOptionData[] = [];

    let metaData = {
      description: 'Default description',
      defaultPermissions: true,
    };

    for (const folderOrFile of topLevel) {
      const filePath = join(path, folderOrFile);
      if ((await stat(filePath)).isFile()) {
        // This is a file
        if (folderOrFile.match(/_meta(.js|.ts)x?$/)) {
          // This is the meta file which should export meta info about the command
          const data = await import(join(path, folderOrFile));
          if (data.description && typeof data.description === 'string') {
            metaData.description = data.description;
          }
          if (
            data.defaultPermissions &&
            typeof data.defaultPermissions === 'boolean'
          ) {
            metaData.defaultPermissions = data.defaultPermissions;
          }
        } else if (folderOrFile.match(JSFileRegex)) {
          const data = await import(join(path, folderOrFile));
          if (!data.default) {
            throw new Error(
              `Expected a default export in file ${join(
                path,
                folderOrFile
              )} but didn't find one`
            );
          }
          const command = data.default;
          if (!isChatCommand(command)) {
            throw new Error(
              `Expected the default export in file ${join(
                path,
                folderOrFile
              )} to be a SlashCommand`
            );
          }
          this.commandMap.set(name + '.' + command.commandInfo.name, command);
          // @ts-expect-error it's gonna complain, but we need to change the type here
          command.commandInfo.type = 'SUB_COMMAND';
          // @ts-expect-error yes TS I know this isn't technically an option type, but the above fixes this
          commandData.push(command.commandInfo);
        }
      } else {
        // This is either a subcommand group or a subcommand
        commandData.push(
          await this.loadSubFolderLevelTwo(
            join(path, folderOrFile),
            folderOrFile,
            name
          )
        );
      }
    }

    return {
      type: 'CHAT_INPUT',
      name,
      ...metaData,
      options: commandData,
    };
  }

  private async loadSubFolderLevelTwo(
    path: string,
    name: string,
    parentName: string
  ): Promise<ApplicationCommandOptionData> {
    const topLevel = await readdir(path);

    const commandData: ApplicationCommandOptionData[] = [];

    let metaData = {
      description: 'Default description',
      defaultPermissions: true,
    };

    for (const folderOrFile of topLevel) {
      const filePath = join(path, folderOrFile);
      if ((await stat(filePath)).isFile()) {
        if (folderOrFile.match(/_meta(.js|.ts)x?$/)) {
          // This is the meta file which should export meta info about the command
          const data = await import(join(path, folderOrFile));
          if (data.description && typeof data.description === 'string') {
            metaData.description = data.description;
          }
          if (
            data.defaultPermissions &&
            typeof data.defaultPermissions === 'boolean'
          ) {
            metaData.defaultPermissions = data.defaultPermissions;
          }
        } else if (folderOrFile.match(JSFileRegex)) {
          const data = await import(join(path, folderOrFile));
          if (!data.default) {
            throw new Error(
              `Expected a default export in file ${join(
                path,
                folderOrFile
              )} but didn't find one`
            );
          }
          const command = data.default;
          if (!isChatCommand(command)) {
            throw new Error(
              `Expected the default export in file ${join(
                path,
                folderOrFile
              )} to be a SlashCommand`
            );
          }
          this.commandMap.set(
            parentName + '.' + name + '.' + command.commandInfo.name,
            command
          );
          // @ts-expect-error it's gonna complain, but we need to change the type here
          command.commandInfo.type = 'SUB_COMMAND';
          // @ts-expect-error yes TS I know this isn't technically an option type, but the above fixes this
          commandData.push(command.commandInfo);
        }
      }
    }

    return {
      type: 'SUB_COMMAND_GROUP',
      name,
      ...metaData,
      // @ts-expect-error yes TS I know this isn't the right type
      options: commandData,
    };
  }

  handleInteractionEvent(interaction: Interaction) {
    this.logger?.debug(interaction);
    if (interaction.isCommand()) {
      // This is a command, pass it to our command handlers
      this.handleCommand(interaction);
      this.emit('commandRun', interaction);
    } else if (interaction.isButton()) {
      if (interaction.customId.startsWith('~')) {
        this.handlePageButton(interaction);
      }
      this.emit('buttonPressed', interaction);
    } else if (interaction.isSelectMenu()) {
      if (interaction.customId.startsWith('~')) {
        this.handlePageSelect(interaction);
      }
      this.emit('selectChanged', interaction);
    } else if (interaction.isContextMenu()) {
      this.handleContextMenu(interaction);
      this.emit('contextMenuRun', interaction);
    } else if (interaction.isAutocomplete()) {
      this.handleAutocomplete(interaction);
      this.emit('autocomplete', interaction);
    }
  }

  private async handleCommand(interaction: CommandInteraction) {
    let commandName = interaction.commandName;
    // @ts-ignore
    if (interaction.options._group) {
      // @ts-ignore
      commandName += '.' + interaction.options._group;
    }
    // @ts-ignore
    if (interaction.options._subcommand) {
      // @ts-ignore
      commandName += '.' + interaction.options._subcommand;
    }
    const command = this.commandMap.get(commandName);
    if (!command) {
      this.logger?.error(`Unregistered command ${commandName} being run`);
      throw new Error(`Unregistered command ${commandName} was run`);
    } else {
      this.logger?.info(`Running command ${commandName}`);
      const data = interaction.options.data;
      const optionsObj: Record<string, any> = {};
      data.forEach((option) => {
        optionsObj[option.name] =
          option.channel ??
          option.member ??
          option.message ??
          option.role ??
          option.user ??
          option.value;
      });
      // @ts-expect-error
      await this.chatCommandMiddleware.execute(
        command.run,
        interaction,
        this,
        optionsObj
      );
    }
  }

  private async handleAutocomplete(interaction: AutocompleteInteraction) {
    const commandName = interaction.commandName;
    const command = this.commandMap.get(commandName);
    if (!command) {
      interaction.respond([]);
    } else {
      const data = interaction.options.data;
      const optionsObj: Record<string, any> = {};
      data.forEach((option) => {
        optionsObj[option.name] =
          option.channel ??
          option.member ??
          option.message ??
          option.role ??
          option.user ??
          option.value;
      });
      const focused = interaction.options.getFocused(true);
      // @ts-expect-error
      await this.autocompleteMiddleware.execute(
        command.autocomplete,
        interaction,
        // @ts-expect-error
        focused.name,
        focused.value,
        this,
        optionsObj
      );
    }
  }

  private async handleContextMenu(interaction: ContextMenuInteraction) {
    const commandName = interaction.commandName;
    const command =
      interaction.targetType === 'MESSAGE'
        ? this.messageContextMenuMap.get(commandName)
        : this.userContextMenuMap.get(commandName);
    if (!command) {
      this.logger?.error(
        `Unregistered context command ${commandName} being run`
      );
      throw new Error(`Unregistered command ${commandName} was run`);
    } else {
      this.logger?.info(`Running context command ${commandName}`);
      this.contextMenuMiddleware.execute(
        command.run,
        // @ts-expect-error this will complain that the types don't match, but it's a waste of a check to split this here.
        interaction,
        this
      );
    }
  }

  private async handlePageButton(interaction: ButtonInteraction) {
    const { page } = this.activePages.get(interaction.message.id) ?? {};
    if (!page) {
      // TODO: Handle loading uncached pages
      throw new Error(
        'Getting button press from uncached page, we need to load it'
      );
    }
    page.handleId(interaction.customId.split(';')[1], interaction);
  }

  private async handlePageSelect(interaction: SelectMenuInteraction) {
    const { page } = this.activePages.get(interaction.message.id) ?? {};
    if (!page) {
      // TODO: Handle loading uncached pages
      throw new Error(
        'Getting button press from uncached page, we need to load it'
      );
    }
    page.handleId(interaction.customId.split(';')[1], interaction);
  }

  async replyToInteractionWithPage(
    page: Page,
    interaction: MessageComponentInteraction | BaseCommandInteraction,
    ephemeral: boolean
  ) {
    const messageOptions = page.render();
    if (ephemeral) {
      // We need to save the interaction instead since it doesn't return a message we can edit
      const message = await interaction.reply({
        ...messageOptions,
        components: messageOptions.components
          ? pageComponentRowsToComponents(messageOptions.components, page)
          : undefined,
        ephemeral: true,
        fetchReply: true,
      });
      page.messsageId = message.id;
      this.activePages.set(message.id, {
        message: interaction,
        page,
      });
    } else {
      const message = await interaction.reply({
        ...messageOptions,
        components: messageOptions.components
          ? pageComponentRowsToComponents(messageOptions.components, page)
          : undefined,
        fetchReply: true,
      });
      page.messsageId = message.id;
      this.activePages.set(message.id, {
        message: message as Message,
        page,
      });
    }
  }

  async sendPageToChannel(page: Page, channel: TextBasedChannel) {
    const messageOptions = page.render();
    const message = await channel.send({
      ...messageOptions,
      components: messageOptions.components
        ? pageComponentRowsToComponents(messageOptions.components, page)
        : undefined,
    });
    page.messsageId = message.id;
    this.activePages.set(message.id, {
      message,
      page,
    });
  }

  async updatePage(page: Page, newState: any) {
    if (!page.messsageId)
      throw new Error('You cannot update a page before it has been sent');
    page.state = newState;
    const messageOptions = page.render();
    const { message } = this.activePages.get(page.messsageId) ?? {};
    if (!message) {
      throw new Error(
        "Tried to update a page that isn't currently loaded, make sure you aren't retaining a reference to a page for a long period of time"
      );
    }
    if (message instanceof Message) {
      if (!message.editable) {
        // This page can't be updated, likely because the bot can no longer see the channel, or it's in a locked thread
        return;
      }
      await message.edit({
        ...messageOptions,
        components: messageOptions.components
          ? pageComponentRowsToComponents(messageOptions.components, page)
          : undefined,
      });
    } else {
      await message.editReply({
        ...messageOptions,
        components: messageOptions.components
          ? pageComponentRowsToComponents(messageOptions.components, page)
          : undefined,
      });
    }
  }
}
