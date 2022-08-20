import {
  AutocompleteInteraction,
  Awaitable,
  BaseGuildTextChannel,
  BitFieldResolvable,
  ButtonInteraction,
  ChatInputCommandInteraction,
  Client,
  ClientEvents,
  ClientOptions,
  CommandInteraction,
  ComponentType,
  ContextMenuCommandInteraction,
  DMChannel,
  Interaction,
  InteractionType,
  InteractionWebhook,
  Message,
  MessageComponentInteraction,
  MessageFlagsString,
  ModalSubmitInteraction,
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
  populateBuilder,
  CommandGroupMetadata,
  isCommandGroupMetadata,
} from './SlashCommandBase';
import { PingableTimedCache } from './PingableTimedCache';
import { TemplateModal } from './TemplateModal';
import {
  ContextMenuCommandBuilder,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  SlashCommandSubcommandGroupBuilder,
} from '@discordjs/builders';
import { ApplicationCommandType, Routes } from 'discord-api-types/v10';
import { REST } from '@discordjs/rest';
import { MaybePromise } from './utilityTypes';

interface SlashasaurusClientEvents extends ClientEvents {
  commandRun: [intercation: CommandInteraction];
  buttonPressed: [interaction: ButtonInteraction];
  selectChanged: [interaction: SelectMenuInteraction];
  contextMenuRun: [interaction: ContextMenuCommandInteraction];
  autocomplete: [interaction: AutocompleteInteraction];
  modalSubmit: [interaction: ModalSubmitInteraction];
}

const JSFileRegex = /(?<!\.d)(\.js|\.ts)x?$/;

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
) => MaybePromise<void>;
type GetPageStateFn = (messageId: string) => MaybePromise<{
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

  /**
   * Whether or not to skip validating and transforming options for autocomplete handlers. Defaults to false.
   */
  skipValidationAndTransformationForAutocomplete?: boolean;
}

interface LogFn {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <T extends object>(obj: T, msg?: string, ...args: any[]): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private commandMap = new Map<string, SlashCommand<any>>();
  private userContextMenuMap = new Map<string, UserCommand>();
  private messageContextMenuMap = new Map<string, MessageCommand>();
  private pageMap = new Map<string, PageMapStorage>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private modalMap = new Map<string, TemplateModal<any, any>>();
  private skipAutocompleteValidationAndTransformation: boolean;
  logger?: Logger;
  chatCommandMiddleware = new Pipeline<CommandRunFunction<[]>>();
  autocompleteMiddleware = new Pipeline<AutocompleteFunction<[]>>();
  contextMenuMiddleware = new Pipeline<
    ContextMenuHandlerType<'MESSAGE'> | ContextMenuHandlerType<'USER'>
  >();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  activePages: PingableTimedCache<Page<any, any>>;
  storePageState: StorePageStateFn;
  getPageState: GetPageStateFn;

  constructor(djsOptions: ClientOptions, options: SlashasaurusClientOptions) {
    super(djsOptions);
    if (options.logger) this.logger = options.logger;
    this.activePages = new PingableTimedCache(
      options.pageTtl ?? 30000,
      (page) => page.pageWillLeaveCache?.()
    );
    this.storePageState = options.storePageState ?? defaultPageStore;
    this.getPageState = options.getPageState ?? defaultPageGet;
    this.skipAutocompleteValidationAndTransformation =
      options.skipValidationAndTransformationForAutocomplete ?? false;
    this.on('interactionCreate', this.handleInteractionEvent);
  }

  /**
   * Registers all command files in the given path
   *
   * @param folderPath The relative path to the folder
   */
  async registerCommandsFrom(
    folderPath: string,
    register: false
  ): Promise<void>;
  async registerCommandsFrom(
    folderPath: string,
    register: true,
    token: string
  ): Promise<void>;
  async registerCommandsFrom(
    folderPath: string,
    register: boolean,
    token?: string
  ): Promise<void> {
    this.logger?.info('Registering global commands');
    const topLevelFolders = await readdir(folderPath);

    const commandData: (SlashCommandBuilder | ContextMenuCommandBuilder)[] = [];

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

    if (register && token) {
      const rest = new REST({ version: '10' }).setToken(token);

      await rest.put(Routes.applicationCommands(this.application.id), {
        body: commandData.map((c) => c.toJSON()),
      });
    }

    this.logger?.info('Finished registering global commands');
  }

  async registerGuildCommandsFrom(
    folderPath: string,
    guildId: string,
    register: false
  ): Promise<void>;
  async registerGuildCommandsFrom(
    folderPath: string,
    guildId: string,
    register: true,
    token: string
  ): Promise<void>;
  async registerGuildCommandsFrom(
    folderPath: string,
    guildId: string,
    register: boolean,
    token?: string
  ): Promise<void> {
    this.logger?.info(`Registering guild commands to ${guildId}`);
    const topLevelFolders = await readdir(folderPath);

    const commandData: (SlashCommandBuilder | ContextMenuCommandBuilder)[] = [];

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

    if (register && token) {
      const rest = new REST({ version: '10' }).setToken(token);
      await rest.put(
        Routes.applicationGuildCommands(this.application.id, guildId),
        {
          body: commandData.map((c) => c.toJSON()),
        }
      );
    }

    this.logger?.info(`Finished registering guild commands to ${guildId}`);
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

    const commandData: ContextMenuCommandBuilder[] = [];

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
          const info = command.commandInfo;
          commandData.push(
            new ContextMenuCommandBuilder()
              .setName(info.name)
              .setType(ApplicationCommandType.User)
              .setNameLocalizations(info.nameLocalizations ?? null)
              .setDefaultMemberPermissions(
                info.defaultMemberPermissions ?? null
              )
              .setDMPermission(info.dmPermission ?? null)
          );
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

    const commandData: ContextMenuCommandBuilder[] = [];

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
          const info = command.commandInfo;
          commandData.push(
            new ContextMenuCommandBuilder()
              .setName(info.name)
              .setType(ApplicationCommandType.Message)
              .setNameLocalizations(info.nameLocalizations ?? null)
              .setDefaultMemberPermissions(
                info.defaultMemberPermissions ?? null
              )
              .setDMPermission(info.dmPermission ?? null)
          );
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

    const commandData: SlashCommandBuilder[] = [];

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
          if (this.commandMap.has(command.commandInfo.name))
            throw new Error(
              `Duplicate command name ${command.commandInfo.name}`
            );
          this.commandMap.set(command.commandInfo.name, command);
          commandData.push(
            populateBuilder(command.commandInfo, new SlashCommandBuilder())
          );
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
  ): Promise<SlashCommandBuilder> {
    const topLevel = await readdir(path);

    const commandData: (
      | SlashCommandSubcommandBuilder
      | SlashCommandSubcommandGroupBuilder
    )[] = [];

    this.logger?.debug(
      `Loading sub-commands from chat/${name}, found ${topLevel.join(', ')}`
    );

    let metaData: CommandGroupMetadata = {
      description: 'Default description',
    };

    for (const folderOrFile of topLevel) {
      const filePath = join(path, folderOrFile);
      if ((await stat(filePath)).isFile()) {
        this.logger?.debug(`Checking if file ${folderOrFile} is a js(x) file`);

        // This is a file
        if (folderOrFile.match(/_meta(.js|.ts)x?$/)) {
          // This is the meta file which should export meta info about the command
          const data = await import(join(path, folderOrFile));
          if (isCommandGroupMetadata(data)) {
            metaData = data;
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
          const mapName = name + '.' + command.commandInfo.name;
          if (this.commandMap.has(mapName))
            throw new Error(`Duplicate command name ${mapName}`);
          this.commandMap.set(mapName, command);
          commandData.push(
            populateBuilder(
              command.commandInfo,
              new SlashCommandSubcommandBuilder()
            )
          );
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

    const builder = new SlashCommandBuilder()
      .setName(name)
      .setNameLocalizations(metaData.nameLocalizations ?? null)
      .setDescription(metaData.description)
      .setDescriptionLocalizations(metaData.descriptionLocalizations ?? null)
      .setDefaultMemberPermissions(metaData.defaultMemberPermissions ?? null)
      .setDMPermission(metaData.dmPermission ?? null);

    commandData.forEach((subcommand) => {
      if (subcommand instanceof SlashCommandSubcommandBuilder) {
        builder.addSubcommand(subcommand);
      } else {
        builder.addSubcommandGroup(subcommand);
      }
    });

    return builder;
  }

  private async loadSubFolderLevelTwo(
    path: string,
    name: string,
    parentName: string
  ): Promise<SlashCommandSubcommandGroupBuilder> {
    const topLevel = await readdir(path);

    const commandData: SlashCommandSubcommandBuilder[] = [];

    this.logger?.debug(
      `Loading sub-commands from chat/${parentName}/${name}, found ${topLevel.join(
        ', '
      )}`
    );

    let metaData: CommandGroupMetadata = {
      description: 'Default description',
    };

    for (const folderOrFile of topLevel) {
      const filePath = join(path, folderOrFile);
      this.logger?.debug(`Checking if file ${folderOrFile} is a js(x) file`);
      if ((await stat(filePath)).isFile()) {
        if (folderOrFile.match(/_meta(.js|.ts)x?$/)) {
          // This is the meta file which should export meta info about the command
          const data = await import(join(path, folderOrFile));
          if (isCommandGroupMetadata(data)) {
            metaData = data;
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
          const mapName =
            parentName + '.' + name + '.' + command.commandInfo.name;
          if (this.commandMap.has(mapName))
            throw new Error(`Duplicate command name ${mapName}`);
          this.commandMap.set(mapName, command);
          commandData.push(
            populateBuilder(
              command.commandInfo,
              new SlashCommandSubcommandBuilder()
            )
          );
          this.logger?.debug(
            `Loaded chat command ${parentName}.${name}.${command.commandInfo.name}`
          );
        }
      }
    }

    this.logger?.debug(
      `Finished loading sub-commands from chat/${parentName}/${name}`
    );

    const builder = new SlashCommandSubcommandGroupBuilder()
      .setName(name)
      .setNameLocalizations(metaData.nameLocalizations ?? null)
      .setDescription(metaData.description)
      .setDescriptionLocalizations(metaData.descriptionLocalizations ?? null);

    commandData.forEach((subcommand) => {
      builder.addSubcommand(subcommand);
    });

    return builder;
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
          if (page.pageId === DEFAULT_PAGE_ID) {
            throw new Error(
              `The page exported in ${join(
                path,
                folderOrFile
              )} does not have a static pageId set.`
            );
          }
          page._client = this;
          const deserialize = page.deserializeState ?? data.deserializeState;
          if (!deserialize) {
            throw new Error(
              `Expected the page to have a static deserializeState function or an export named "deserializeState" in file ${join(
                path,
                folderOrFile
              )} but didn't find one`
            );
          }
          this.pageMap.set(page.pageId, {
            page,
            deserialize: deserialize,
          });
        }
      } else {
        throw new Error(
          `Found folder in pages directory ${join(path, folderOrFile)}`
        );
      }
    }
  }

  async registerModalsFrom(path: string) {
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
          const modal = data.default;
          if (!(modal instanceof TemplateModal)) {
            throw new Error(
              `Expected the default export in file ${join(
                path,
                folderOrFile
              )} to be a TemplateModal`
            );
          }
          this.modalMap.set(modal.customId, modal);
        }
      } else {
        throw new Error(
          `Found folder in modals directory ${join(path, folderOrFile)}`
        );
      }
    }
  }

  private handleInteractionEvent(interaction: Interaction) {
    this.logger?.debug(interaction);
    switch (interaction.type) {
      case InteractionType.ApplicationCommand:
        if (interaction.commandType === ApplicationCommandType.ChatInput) {
          this.handleCommand(interaction);
          this.emit('commandRun', interaction);
        } else if (
          interaction.commandType === ApplicationCommandType.Message ||
          interaction.commandType === ApplicationCommandType.User
        ) {
          this.handleContextMenu(interaction);
          this.emit('contextMenuRun', interaction);
        }
        break;
      case InteractionType.ApplicationCommandAutocomplete:
        this.handleAutocomplete(interaction);
        this.emit('autocomplete', interaction);
        break;
      case InteractionType.MessageComponent:
        if (interaction.componentType === ComponentType.Button) {
          if (interaction.customId.startsWith('~')) {
            this.handlePageButton(interaction);
          }
          this.emit('buttonPressed', interaction);
        } else if (interaction.componentType === ComponentType.SelectMenu) {
          if (interaction.customId.startsWith('~')) {
            this.handlePageSelect(interaction);
          }
          this.emit('selectChanged', interaction);
        }
        break;
      case InteractionType.ModalSubmit:
        this.handleModalSubmit(interaction);
        this.emit('modalSubmit', interaction);
        break;
    }
  }

  private async handleCommand(interaction: ChatInputCommandInteraction) {
    let commandName = interaction.commandName;
    // @ts-expect-error This is TS-private, but I know what I'm doing
    if (interaction.options._group) {
      // @ts-expect-error This is TS-private, but I know what I'm doing
      commandName += '.' + interaction.options._group;
    }
    // @ts-expect-error This is TS-private, but I know what I'm doing
    if (interaction.options._subcommand) {
      // @ts-expect-error This is TS-private, but I know what I'm doing
      commandName += '.' + interaction.options._subcommand;
    }
    const command = this.commandMap.get(commandName);
    if (!command) {
      this.logger?.error(`Unregistered command ${commandName} being run`);
      throw new Error(`Unregistered command ${commandName} was run`);
    } else {
      this.logger?.info(`Running command ${commandName}`);
      const optionsObj = await command.validateAndTransformOptions(interaction);
      // If there is errors, we want to send them back to the user
      if (Array.isArray(optionsObj)) {
        await interaction.reply({
          content: optionsObj.join('\n'),
          ephemeral: true,
        });
        return;
      }
      await this.chatCommandMiddleware.execute(
        command.run,
        interaction,
        this,
        optionsObj
      );
    }
  }

  private async handleAutocomplete(interaction: AutocompleteInteraction) {
    let commandName = interaction.commandName;
    // @ts-expect-error This is TS-private, but I know what I'm doing
    if (interaction.options._group) {
      // @ts-expect-error This is TS-private, but I know what I'm doing
      commandName += '.' + interaction.options._group;
    }
    // @ts-expect-error This is TS-private, but I know what I'm doing
    if (interaction.options._subcommand) {
      // @ts-expect-error This is TS-private, but I know what I'm doing
      commandName += '.' + interaction.options._subcommand;
    }
    const command = this.commandMap.get(commandName);
    if (!command) {
      interaction.respond([]);
    } else {
      const optionsObj = await command.validateAndTransformOptions(
        interaction,
        true,
        this.skipAutocompleteValidationAndTransformation
      );
      const focused = interaction.options.getFocused(true);
      const autocompleteFn = command.autocompleteMap.get(focused.name);
      if (autocompleteFn) {
        await this.autocompleteMiddleware.execute(
          (interaction, _name, value, client) => {
            autocompleteFn(interaction, value, client);
          },
          interaction,
          // @ts-expect-error This will complain because the autocomplete is typed here with []
          focused.name,
          focused.value,
          this,
          optionsObj
        );
      } else {
        // @ts-expect-error This will complain because the autocomplete is typed here with []
        await this.autocompleteMiddleware.execute(
          command.autocomplete,
          interaction,
          // @ts-expect-error This will complain because the autocomplete is typed here with []
          focused.name,
          focused.value,
          this,
          optionsObj
        );
      }
    }
  }

  private async handleContextMenu(interaction: ContextMenuCommandInteraction) {
    const commandName = interaction.commandName;
    const command =
      interaction.commandType === ApplicationCommandType.Message
        ? this.messageContextMenuMap.get(commandName)
        : this.userContextMenuMap.get(commandName);
    if (!command) {
      this.logger?.error(
        `Unregistered context command ${commandName} being run`
      );
      throw new Error(`Unregistered command ${commandName} was run`);
    } else {
      this.logger?.info(`Running context command ${commandName}`);
      // @ts-expect-error This is going to complain because the context menu handler is typed with a more specific type
      this.contextMenuMiddleware.execute(command.run, interaction, this);
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
          content: null,
          embeds: null,
          ...renderedPage,
          components: renderedPage.components
            ? pageComponentRowsToComponents(renderedPage.components, page)
            : [],
          fetchReply: true,
          flags: renderedPage.flags as unknown as BitFieldResolvable<
            MessageFlagsString,
            number
          >,
        });
        interaction.followUp({
          content:
            "An older version of this page was stored, it's been updated. Click the button you want again.",
          ephemeral: true,
        });
        return;
      }
    }
    const message = page.message;
    if (message instanceof PageInteractionReplyMessage) {
      // If this page was an interaction reply (meaning it was ephemeral), update the interaction to extend the lifetime of the token
      page.message = new PageInteractionReplyMessage(
        interaction.webhook,
        message.id
      );
      // Store the updated page
      const state = await page.serializeState();
      this.storePageState(
        page.message.id,
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
            : [],
          fetchReply: true,
          flags: renderedPage.flags as unknown as BitFieldResolvable<
            MessageFlagsString,
            number
          >,
        });
        interaction.followUp({
          content:
            "An older version of this page was stored, it's been updated. Make your selection again.",
          ephemeral: true,
        });
        return;
      }
    }
    const message = page.message;
    if (message instanceof PageInteractionReplyMessage) {
      // If this page was an interaction reply (meaning it was ephemeral), update the interaction to extend the lifetime of the token
      page.message = new PageInteractionReplyMessage(
        interaction.webhook,
        message.id
      );
      // Store the updated page
      const state = await page.serializeState();
      this.storePageState(
        page.message.id,
        page.constructor.pageId,
        state,
        messageToMessageData(page.message)
      );
    }
    page.latestInteraction = interaction;
    page.handleId(interaction.customId.split(';')[1], interaction);
  }

  private async handleModalSubmit(interaction: ModalSubmitInteraction) {
    const modal = this.modalMap.get(interaction.customId);
    if (!modal) return;
    const values: Record<string, string> = {};
    interaction.fields.fields.forEach((field) => {
      values[field.customId] = field.value;
    });
    modal.handler(interaction, values);
  }

  async replyToInteractionWithPage<P, S>(
    page: Page<P, S>,
    interaction: MessageComponentInteraction | CommandInteraction,
    ephemeral: boolean
  ) {
    const messageOptions = await page.render();
    if (ephemeral) {
      // We need to save the interaction instead since it doesn't return a message we can edit
      const message = await interaction.reply({
        ...messageOptions,
        components: messageOptions.components
          ? pageComponentRowsToComponents(messageOptions.components, page)
          : [],
        ephemeral: true,
        fetchReply: true,
        flags: messageOptions.flags as unknown as BitFieldResolvable<
          'SuppressEmbeds' | 'Ephemeral',
          number
        >,
      });
      page.message = new PageInteractionReplyMessage(
        interaction.webhook,
        message.id
      );
      const state = await page.serializeState();
      this.storePageState(
        message.id,
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
          : [],
        fetchReply: true,
        flags: messageOptions.flags as unknown as BitFieldResolvable<
          'SuppressEmbeds' | 'Ephemeral',
          number
        >,
      });
      page.message = new PageInteractionReplyMessage(
        interaction.webhook,
        message.id
      );
      const state = await page.serializeState();
      this.storePageState(
        message.id,
        page.constructor.pageId,
        state,
        messageToMessageData(page.message)
      );
      this.activePages.set(message.id, page);
    }
    page.pageDidSend?.();
  }

  async sendPageToChannel<P, S>(page: Page<P, S>, channel: TextBasedChannel) {
    const messageOptions = await page.render();
    const message = await channel.send({
      ...messageOptions,
      components: messageOptions.components
        ? pageComponentRowsToComponents(messageOptions.components, page)
        : [],
    });
    page.message = message;
    const state = await page.serializeState();
    this.storePageState(
      message.id,
      page.constructor.pageId,
      state,
      messageToMessageData(page.message)
    );
    this.activePages.set(message.id, page);
    page.pageDidSend?.();
  }

  async updatePage<P, S>(page: Page<P, S>, newState: S) {
    if (!page.message)
      throw new Error('You cannot update a page before it has been sent');
    page.state = newState;
    const messageOptions = await page.render();
    const { message } = page;
    if (
      message instanceof PageInteractionReplyMessage &&
      page.latestInteraction &&
      !(page.latestInteraction.deferred || page.latestInteraction.replied)
    ) {
      await page.latestInteraction.update({
        ...messageOptions,
        components: messageOptions.components
          ? pageComponentRowsToComponents(messageOptions.components, page)
          : [],
        flags: messageOptions.flags as unknown as BitFieldResolvable<
          MessageFlagsString,
          number
        >,
      });
    } else {
      await message.edit({
        ...messageOptions,
        components: messageOptions.components
          ? pageComponentRowsToComponents(messageOptions.components, page)
          : [],
        flags: messageOptions.flags as unknown as BitFieldResolvable<
          MessageFlagsString,
          number
        >,
      });
    }
    const state = await page.serializeState();
    this.activePages.set(message.id, page);
    this.storePageState(
      page.message instanceof Message ? page.message.id : page.message.id,
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
