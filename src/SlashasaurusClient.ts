import {
  ApplicationCommandData,
  ApplicationCommandOptionData,
  AutocompleteInteraction,
  Awaitable,
  BaseCommandInteraction,
  BaseGuildTextChannel,
  ButtonInteraction,
  Client,
  ClientEvents,
  ClientOptions,
  CommandInteraction,
  ContextMenuInteraction,
  DMChannel,
  Interaction,
  InteractionWebhook,
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
import {
  compareMessages,
  DEFAULT_PAGE_ID,
  DeserializeStateFn,
  isPage,
  Page,
  pageComponentRowsToComponents,
  PageInteractionReplyMessage,
} from './Page';
import {
  SlashCommand,
  CommandRunFunction,
  AutocompleteFunction,
  isChatCommand,
} from './SlashCommandBase';
import { PingableTimedCache } from './PingableTimedCache';

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

interface MessageData {
  guildId: string;
  channelId: string;
  messageId: string;
}

interface InteractionMessageData {
  webhookToken: string;
  messageId: string;
}

type StorePageStateFn = (
  messageId: string,
  pageId: string,
  state: string,
  messageData: string
) => Promise<void>;
type GetPageStateFn = (messageId: string) => Promise<{
  pageId: string;
  stateString: string;
  messageData: string;
}>;

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

  /**
   * This function is used to persistently store the page state in case
   * it needs to leave the cache or the bot suddenly shuts down.
   */
  storePageState?: StorePageStateFn;

  /**
   * This function will retreive the page from your persistent storage
   * when the page is "woken up."
   */
  getPageState?: GetPageStateFn;

  /**
   * The amount of time (in ms) that pages will stay in the cache after they
   * were last interacted with. The default is 30 seconds.
   */
  pageTtl?: number;
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

interface PageMapStorage {
  page: Page['constructor'];
  deserialize: DeserializeStateFn;
}

async function defaultPageStore() {
  throw new Error(
    `You must implement storePageState and getPageState in order to use pages`
  );
}

async function defaultPageGet(): Promise<{
  pageId: string;
  stateString: string;
  messageData: string;
}> {
  throw new Error(
    `You must implement storePageState and getPageState in order to use pages`
  );
  return {
    pageId: 'error',
    messageData: 'error',
    stateString: '',
  };
}

export class SlashasaurusClient extends Client<true> {
  private commandMap = new Map<string, SlashCommand<any>>();
  private userContextMenuMap = new Map<string, UserCommand>();
  private messageContextMenuMap = new Map<string, MessageCommand>();
  private pageMap = new Map<string, PageMapStorage>();
  logger?: Logger;
  devServerId: string;
  chatCommandMiddleware = new Pipeline<CommandRunFunction<[]>>();
  autocompleteMiddleware = new Pipeline<AutocompleteFunction<[]>>();
  contextMenuMiddleware = new Pipeline<
    ContextMenuHandlerType<'MESSAGE'> | ContextMenuHandlerType<'USER'>
  >();

  activePages: PingableTimedCache<Page>;
  storePageState: StorePageStateFn;
  getPageState: GetPageStateFn;

  constructor(djsOptions: ClientOptions, options: SlashasaurusClientOptions) {
    super(djsOptions);
    this.logger = options.logger;
    this.devServerId = options.devServerId;
    this.activePages = new PingableTimedCache(options.pageTtl ?? 30000);
    this.storePageState = options.storePageState ?? defaultPageStore;
    this.getPageState = options.getPageState ?? defaultPageGet;
    this.on('interactionCreate', this.handleInteractionEvent);
  }

  /**
   * Registers all command files in the given path
   *
   * @param folderPath The relative path to the folder
   */
  // TODO: guild specific commands
  // guild commands will be a 0.3 thing probably tbh (lol ok that totally happened :mmLol:)
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

    let manager = this.application!.commands;
    if (registerTo === 'dev') {
      manager.set(commandData, this.devServerId);
    } else if (registerTo === 'global') {
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

    this.logger?.debug(
      `Loading user commands from folder, found ${topLevel.join(', ')}`
    );

    for (const folderOrFile of topLevel) {
      const filePath = join(path, folderOrFile);
      if ((await stat(filePath)).isFile()) {
        this.logger?.debug(`Checking if file ${folderOrFile} is a js(x) file`);
        if (folderOrFile.match(JSFileRegex)) {
          this.logger?.debug(
            `Checking if file ${folderOrFile} contains a command`
          );
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
          this.logger?.debug(`Loaded user command ${command.commandInfo.name}`);
        }
      } else {
        throw new Error(
          `Found folder at ${filePath}, context menu commands cannot have subcommands`
        );
      }
    }

    this.logger?.debug(`Finished loading user commands from folder`);

    return commandData;
  }

  private async loadMessageCommands(path: string) {
    const topLevel = await readdir(path);

    const commandData: ApplicationCommandData[] = [];

    this.logger?.debug(
      `Loading message commands from folder, found ${topLevel.join(', ')}`
    );

    for (const folderOrFile of topLevel) {
      const filePath = join(path, folderOrFile);
      if ((await stat(filePath)).isFile()) {
        this.logger?.debug(`Checking if file ${folderOrFile} is a js(x) file`);
        if (folderOrFile.match(JSFileRegex)) {
          this.logger?.debug(
            `Checking if file ${folderOrFile} contains a command`
          );
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
          this.logger?.debug(
            `Loaded message command ${command.commandInfo.name}`
          );
        }
      } else {
        throw new Error(
          `Found folder at ${filePath}, context menu commands cannot have subcommands`
        );
      }
    }

    this.logger?.debug(`Finished loading message commands from folder`);

    return commandData;
  }

  private async loadTopLevelCommands(path: string) {
    const topLevel = await readdir(path);

    const commandData: ApplicationCommandData[] = [];

    this.logger?.debug(
      `Loading chat commands from folder, found ${topLevel.join(', ')}`
    );

    for (const folderOrFile of topLevel) {
      const filePath = join(path, folderOrFile);
      if ((await stat(filePath)).isFile()) {
        this.logger?.debug(`Checking if file ${folderOrFile} is a js(x) file`);
        if (folderOrFile.match(JSFileRegex)) {
          this.logger?.debug(
            `Checking if file ${folderOrFile} contains a command`
          );
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
          this.logger?.debug(
            `Checking if default export of ${folderOrFile} is a command`
          );
          const command = data.default;
          if (!isChatCommand(command)) {
            throw new Error(
              `Expected the default export in file ${join(
                path,
                folderOrFile
              )} to be a SlashCommand`
            );
          }
          this.logger?.debug(
            `Adding command from ${folderOrFile} to command map`
          );
          this.commandMap.set(command.commandInfo.name, command);
          commandData.push(command.commandInfo as any);
          this.logger?.debug(`Loaded chat command ${command.commandInfo.name}`);
        }
      } else {
        // This has subcommands
        commandData.push(
          await this.loadSubFolderLevelOne(filePath, folderOrFile)
        );
      }
    }

    this.logger?.debug(`Finished loading chat commands from folder`);

    return commandData;
  }

  private async loadSubFolderLevelOne(
    path: string,
    name: string
  ): Promise<ApplicationCommandData> {
    const topLevel = await readdir(path);

    const commandData: ApplicationCommandOptionData[] = [];

    this.logger?.debug(
      `Loading sub-commands from chat/${name}, found ${topLevel.join(', ')}`
    );

    let metaData = {
      description: 'Default description',
      defaultPermissions: true,
    };

    for (const folderOrFile of topLevel) {
      const filePath = join(path, folderOrFile);
      if ((await stat(filePath)).isFile()) {
        this.logger?.debug(`Checking if file ${folderOrFile} is a js(x) file`);

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
          this.logger?.debug(
            `Checking if file ${folderOrFile} contains a command`
          );
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
          this.logger?.debug(
            `Checking if default export of ${folderOrFile} is a command`
          );
          const command = data.default;
          if (!isChatCommand(command)) {
            throw new Error(
              `Expected the default export in file ${join(
                path,
                folderOrFile
              )} to be a SlashCommand`
            );
          }
          this.logger?.debug(
            `Adding command from ${folderOrFile} to command map`
          );
          this.commandMap.set(name + '.' + command.commandInfo.name, command);
          command.commandInfo.type = 'SUB_COMMAND';
          // @ts-expect-error yes TS I know this isn't technically an option type, but the above fixes this
          commandData.push(command.commandInfo);
          this.logger?.debug(
            `Loaded chat command ${name}.${command.commandInfo.name}`
          );
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

    this.logger?.debug(`Finished loading sub-commands from chat/${name}`);

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

    this.logger?.debug(
      `Loading sub-commands from chat/${parentName}/${name}, found ${topLevel.join(
        ', '
      )}`
    );

    let metaData = {
      description: 'Default description',
      defaultPermissions: true,
    };

    for (const folderOrFile of topLevel) {
      const filePath = join(path, folderOrFile);
      this.logger?.debug(`Checking if file ${folderOrFile} is a js(x) file`);
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
          this.logger?.debug(
            `Checking if file ${folderOrFile} contains a command`
          );
          const data = await import(join(path, folderOrFile));
          if (!data.default) {
            throw new Error(
              `Expected a default export in file ${join(
                path,
                folderOrFile
              )} but didn't find one`
            );
          }
          this.logger?.debug(
            `Checking if default export of ${folderOrFile} is a command`
          );
          const command = data.default;
          if (!isChatCommand(command)) {
            throw new Error(
              `Expected the default export in file ${join(
                path,
                folderOrFile
              )} to be a SlashCommand`
            );
          }
          this.logger?.debug(
            `Adding command from ${folderOrFile} to command map`
          );
          this.commandMap.set(
            parentName + '.' + name + '.' + command.commandInfo.name,
            command
          );
          command.commandInfo.type = 'SUB_COMMAND';
          // @ts-expect-error yes TS I know this isn't technically an option type, but the above fixes this
          commandData.push(command.commandInfo);
          this.logger?.debug(
            `Loaded chat command ${parentName}.${name}.${command.commandInfo.name}`
          );
        }
      }
    }

    this.logger?.debug(
      `Finished loading sub-commands from chat/${parentName}/${name}`
    );

    return {
      type: 'SUB_COMMAND_GROUP',
      name,
      ...metaData,
      // @ts-expect-error yes TS I know this isn't the right type
      options: commandData,
    };
  }

  async registerPagesFrom(path: string) {
    const topLevel = await readdir(path);

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
          const page = data.default;
          if (!isPage(page)) {
            throw new Error(
              `Expected the default export in file ${join(
                path,
                folderOrFile
              )} to be a Page`
            );
          }
          // @ts-expect-error messing with statics is fun
          if (page.pageId === DEFAULT_PAGE_ID) {
            throw new Error(
              `The page exported in ${join(
                path,
                folderOrFile
              )} does not have a static pageId set.`
            );
          }
          // @ts-expect-error but not very functional
          page._client = this;
          if (!data.deserializeState) {
            throw new Error(
              `Expected an export named "deserializeState" in file ${join(
                path,
                folderOrFile
              )} but didn't find one`
            );
          }
          // @ts-expect-error it does exist :sobbing:
          this.pageMap.set(page.pageId, {
            page,
            deserialize: data.deserializeState,
          });
        }
      } else {
        throw new Error(
          `Found folder in pages directory ${join(path, folderOrFile)}`
        );
      }
    }
  }

  private handleInteractionEvent(interaction: Interaction) {
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
      await Promise.all(
        data.map((option) => {
          if (command.transformersMap.has(option.name)) {
            return command.transformersMap.get(option.name)!(
              option.value as string | number
            ).then((value: any) => {
              optionsObj[option.name] = value;
            });
          } else {
            optionsObj[option.name] =
              option.channel ??
              option.member ??
              option.message ??
              option.role ??
              option.user ??
              option.value;
          }
        })
      );
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
      await Promise.all(
        data.map((option) => {
          if (command.transformersMap.has(option.name)) {
            return command.transformersMap.get(option.name)!(
              option.value as string | number
            ).then((value: any) => {
              optionsObj[option.name] = value;
            });
          } else {
            optionsObj[option.name] =
              option.channel ??
              option.member ??
              option.message ??
              option.role ??
              option.user ??
              option.value;
          }
        })
      );
      const focused = interaction.options.getFocused(true);
      const autocompleteFn = command.autocompleteMap.get(focused.name);
      if (autocompleteFn) {
        await this.autocompleteMiddleware.execute(
          (interaction, _name, value, client) => {
            autocompleteFn(interaction, value, client);
          },
          interaction,
          // @ts-expect-error
          focused.name,
          focused.value,
          this,
          optionsObj
        );
      } else {
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
    let page = this.activePages.get(interaction.message.id);
    if (!page) {
      page = await this.getPageFromMessage(interaction.message.id, interaction);
      if (!page) {
        return;
      }
      this.activePages.set(interaction.message.id, page);
      const renderedPage = await page.render();
      if (!compareMessages(interaction.message, renderedPage)) {
        await interaction.update({
          ...renderedPage,
          components: renderedPage.components
            ? pageComponentRowsToComponents(renderedPage.components, page)
            : undefined,
          fetchReply: true,
        });
        interaction.followUp({
          content:
            "An older version of this page was stored, it's been updated. Click the button you want again.",
          ephemeral: true,
        });
        return;
      }
    }
    if (page.message instanceof PageInteractionReplyMessage) {
      // If this page was an interaction reply (meaning it was ephemeral), update the interaction to extend the lifetime of the token
      page.message = new PageInteractionReplyMessage(
        interaction.webhook,
        page.message!.id
      );
      // Store the updated page
      const state = await page.serializeState();
      this.storePageState(
        page.message!.id,
        // @ts-expect-error gonna complain about pageId on the constructor again
        page.constructor.pageId,
        state,
        messageToMessageData(page.message)
      );
    }
    page.latestInteraction = interaction;
    page.handleId(interaction.customId.split(';')[1], interaction);
  }

  private async handlePageSelect(interaction: SelectMenuInteraction) {
    let page = this.activePages.get(interaction.message.id);
    if (!page) {
      page = await this.getPageFromMessage(interaction.message.id, interaction);
      if (!page) {
        return;
      }
      this.activePages.set(interaction.message.id, page);
      const renderedPage = await page.render();
      if (!compareMessages(interaction.message, renderedPage)) {
        await interaction.update({
          ...renderedPage,
          components: renderedPage.components
            ? pageComponentRowsToComponents(renderedPage.components, page)
            : undefined,
          fetchReply: true,
        });
        interaction.followUp({
          content:
            "An older version of this page was stored, it's been updated. Make your selection again.",
          ephemeral: true,
        });
        return;
      }
    }
    if (page.message instanceof PageInteractionReplyMessage) {
      // If this page was an interaction reply (meaning it was ephemeral), update the interaction to extend the lifetime of the token
      page.message = new PageInteractionReplyMessage(
        interaction.webhook,
        page.message!.id
      );
      // Store the updated page
      const state = await page.serializeState();
      this.storePageState(
        page.message!.id,
        // @ts-expect-error gonna complain about pageId on the constructor again
        page.constructor.pageId,
        state,
        messageToMessageData(page.message)
      );
    }
    page.latestInteraction = interaction;
    page.handleId(interaction.customId.split(';')[1], interaction);
  }

  async replyToInteractionWithPage(
    page: Page,
    interaction: MessageComponentInteraction | BaseCommandInteraction,
    ephemeral: boolean
  ) {
    const messageOptions = await page.render();
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
      page.message = new PageInteractionReplyMessage(
        interaction.webhook,
        message.id
      );
      const state = await page.serializeState();
      this.storePageState(
        message.id,
        // @ts-expect-error gonna complain about pageId on the constructor again
        page.constructor.pageId,
        state,
        messageToMessageData(page.message)
      );
      this.activePages.set(message.id, page);
    } else {
      const message = await interaction.reply({
        ...messageOptions,
        components: messageOptions.components
          ? pageComponentRowsToComponents(messageOptions.components, page)
          : undefined,
        fetchReply: true,
      });
      page.message = new PageInteractionReplyMessage(
        interaction.webhook,
        message.id
      );
      const state = await page.serializeState();
      this.storePageState(
        message.id,
        // @ts-expect-error gonna complain about pageId on the constructor again
        page.constructor.pageId,
        state,
        messageToMessageData(page.message)
      );
      this.activePages.set(message.id, page);
    }
  }

  async sendPageToChannel(page: Page, channel: TextBasedChannel) {
    const messageOptions = await page.render();
    const message = await channel.send({
      ...messageOptions,
      components: messageOptions.components
        ? pageComponentRowsToComponents(messageOptions.components, page)
        : undefined,
    });
    page.message = message;
    const state = await page.serializeState();
    this.storePageState(
      message.id,
      // @ts-expect-error gonna complain about pageId on the constructor again
      page.constructor.pageId,
      state,
      messageToMessageData(page.message)
    );
    this.activePages.set(message.id, page);
  }

  async updatePage(page: Page, newState: any) {
    if (!page.message)
      throw new Error('You cannot update a page before it has been sent');
    page.state = newState;
    const messageOptions = await page.render();
    const { message } = page;
    if (
      message instanceof PageInteractionReplyMessage &&
      page.latestInteraction &&
      !page.latestInteraction.deferred
    ) {
      await page.latestInteraction.update({
        ...messageOptions,
        components: messageOptions.components
          ? pageComponentRowsToComponents(messageOptions.components, page)
          : undefined,
      });
    } else {
      await message.edit({
        ...messageOptions,
        components: messageOptions.components
          ? pageComponentRowsToComponents(messageOptions.components, page)
          : undefined,
      });
    }
    const state = await page.serializeState();
    this.activePages.set(message.id, page);
    this.storePageState(
      page.message instanceof Message ? page.message.id : page.message.id,
      // @ts-expect-error gonna complain about pageId on the constructor again
      page.constructor.pageId,
      state,
      messageToMessageData(page.message)
    );
  }

  async getPageFromMessage(
    messageOrId: Message | string,
    interaction: MessageComponentInteraction | CommandInteraction
  ) {
    const id = typeof messageOrId === 'string' ? messageOrId : messageOrId.id;
    const cachedPage = this.activePages.get(id);
    if (!cachedPage) {
      const { pageId, stateString, messageData } = await this.getPageState(id);
      const message =
        messageOrId instanceof Message
          ? messageOrId
          : await this.getMessage(JSON.parse(messageData));
      if (!message)
        throw new Error(
          `Failed to load Page message. ${JSON.stringify(messageData)}`
        );
      const { page: pageConstructor, deserialize } =
        this.pageMap.get(pageId) ?? {};
      if (!pageConstructor || !deserialize)
        throw new Error(
          `A component tried to load a page type that isn't registered, ${pageId}`
        );
      const deserialized = await deserialize(stateString, interaction);
      if (!('props' in deserialized)) {
        if (message instanceof Message) {
          await message.delete();
        } else {
          await message.edit({
            content: 'This page has been closed',
            components: [],
          });
        }
        return;
      }
      const { props, state } = deserialized;
      // @ts-expect-error will complain, but we know this is a constructor and JS will complain if we don't do `new`
      const newPage: Page = new pageConstructor(props);
      newPage.state = state;
      newPage.message = message;
      const rendered = await newPage.render();
      if (rendered.components)
        pageComponentRowsToComponents(rendered.components, newPage);
      this.activePages.set(message.id, newPage);
      return newPage;
    }
    return cachedPage;
  }

  private async getMessage(messageData: MessageData | InteractionMessageData) {
    if ('guildId' in messageData) {
      try {
        if (messageData.guildId !== 'dm') {
          const guild = await this.guilds.fetch(messageData.guildId);
          const channel = await guild.channels.fetch(messageData.channelId);
          if (!(channel instanceof BaseGuildTextChannel))
            throw new Error(
              `Channel for saved Page was not a text channel, this likely means there's something wrong with the storage. ${messageData.guildId}/${messageData.channelId}/${messageData.messageId}`
            );
          return channel.messages.fetch(messageData.messageId);
        } else {
          const channel = await this.channels.fetch(messageData.channelId);
          if (!(channel instanceof DMChannel))
            throw new Error(
              `Channel for saved Page was not a DMChannel, this likely means there's something wrong with the storage. ${messageData.guildId}/${messageData.channelId}/${messageData.messageId}`
            );
        }
      } catch (e) {
        throw new Error(
          `Tried to fetch a message the bot can no longer see: ${messageData.guildId}/${messageData.channelId}/${messageData.messageId}`
        );
      }
    } else {
      return new PageInteractionReplyMessage(
        new InteractionWebhook(
          this,
          this.application.id,
          messageData.webhookToken
        ),
        messageData.messageId
      );
    }
    return;
  }
}

function messageToMessageData(
  message: Message | PageInteractionReplyMessage
): string {
  if (message instanceof Message) {
    return JSON.stringify({
      messageId: message.id,
      channelId: message.channelId,
      guildId: message.guildId ?? 'dm',
    });
  } else {
    return JSON.stringify({
      webhookToken: message.webhook.token,
      messageId: message.id,
    });
  }
}
