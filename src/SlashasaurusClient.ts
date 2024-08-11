import {
  ContextMenuCommandBuilder,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  SlashCommandSubcommandGroupBuilder,
} from '@discordjs/builders';
import { REST } from '@discordjs/rest';
import {
  ApplicationCommandType,
  MessageFlags,
  Routes,
} from 'discord-api-types/v10';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import { Connector } from './Connector';
import {
  ContextMenuHandlerType,
  isMessageCommand,
  isUserCommand,
  MessageCommand,
  UserCommand,
} from './ContextMenuBase';
import { Middleware, Pipeline } from './MiddlewarePipeline';
import {
  compareMessages,
  DEFAULT_PAGE_ID,
  DeserializeStateFn,
  isPage,
  Page,
  pageComponentRowsToComponents,
  PageInteractionReplyMessage,
} from './Page';
import { PingableTimedCache } from './PingableTimedCache';
import {
  AutocompleteFunction,
  CommandGroupMetadata,
  CommandRunFunction,
  isChatCommand,
  isCommandGroupMetadata,
  populateBuilder,
  SlashCommand,
} from './SlashCommandBase';
import { TemplateModal } from './TemplateModal';
import { GetConnectorType, MaybePromise } from './utilityTypes';

const JSFileRegex = /(?<!\.d)(\.js|\.ts)x?$/;

export interface MessageData {
  channelId: string;
  messageId: string;
}

export interface InteractionMessageData {
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
   * The client to use
   */
  client: GetConnectorType<'Client'>;

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

export class SlashasaurusClient {
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

  client: GetConnectorType<'Client'>;
  connector: Connector;

  constructor(connector: Connector, options: SlashasaurusClientOptions) {
    this.client = options.client;
    this.connector = connector;
    if (options.logger) this.logger = options.logger;
    this.activePages = new PingableTimedCache(
      options.pageTtl ?? 30000,
      (page) => page.pageWillLeaveCache?.()
    );
    this.storePageState = options.storePageState ?? defaultPageStore;
    this.getPageState = options.getPageState ?? defaultPageGet;
    this.skipAutocompleteValidationAndTransformation =
      options.skipValidationAndTransformationForAutocomplete ?? false;
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

      await rest.put(
        Routes.applicationCommands(
          this.connector.getApplicationId(this.client)
        ),
        {
          body: commandData.map((c) => c.toJSON()),
        }
      );
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
        Routes.applicationGuildCommands(
          this.connector.getApplicationId(this.client),
          guildId
        ),
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

  // #region Command Loading

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

  // #endregion

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

  /**
   * Takes info about a command and calls the handler if it exists, otherwise, returns false to indicate that the command doesn't exist
   * @param fullyQualifiedName The name of the command being called, must be in the format of `parent.subcommandgroup.subcommand`
   * @param interaction The interaction object
   */
  async handleCommand(
    fullyQualifiedName: string,
    interaction: GetConnectorType<'ChatInputCommandInteraction'>
  ) {
    const command = this.commandMap.get(fullyQualifiedName);
    if (!command) {
      return false;
    } else {
      this.logger?.info(`Running command ${fullyQualifiedName}`);
      const optionsObj = await command.validateAndTransformOptions(
        interaction,
        this.connector
      );
      // If there is errors, we want to send them back to the user
      if (Array.isArray(optionsObj)) {
        await this.connector.replyToInteraction(interaction, {
          content: optionsObj.join('\n'),
          flags: 1 << 6,
        });
        return;
      }
      await this.chatCommandMiddleware.execute(
        command.run,
        interaction,
        this,
        optionsObj
      );
      return true;
    }
  }

  /**
   * Takes info about a command and calls the autocomplete handler if it exists, otherwise, returns false to indicate that the command doesn't exist
   * @param name The name of the command being called, must be in the format of `parent.subcommandgroup.subcommand`
   * @param focusedName The name of the option that is being focused
   * @param focusedValue The value of the option that is being focused
   * @param interaction The interaction object
   */
  async handleAutocomplete(
    name: string,
    focusedName: string,
    focusedValue: unknown,
    interaction: GetConnectorType<'AutocompleteInteraction'>
  ) {
    const command = this.commandMap.get(name);
    if (!command) {
      return false;
    }
    const optionsObj = await command.validateAndTransformOptions(
      interaction,
      this.connector,
      true,
      this.skipAutocompleteValidationAndTransformation
    );
    const autocompleteFn = command.autocompleteMap.get(focusedName);
    if (autocompleteFn) {
      await this.autocompleteMiddleware.execute(
        (interaction, _name, value, client) => {
          autocompleteFn(interaction, value, client);
        },
        interaction,
        // @ts-expect-error this counts as never, but we know it's right
        focusedName,
        focusedValue,
        this,
        optionsObj
      );
      return true;
    } else {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore pain
      await this.autocompleteMiddleware.execute(
        command.autocomplete,
        interaction,
        // @ts-expect-error this counts as never, but we know it's right
        focusedName,
        focusedValue,
        this,
        optionsObj
      );
      return true;
    }
  }

  /**
   * Takes info about a context menu command and calls the handler if it exists, otherwise, returns false to indicate that the command doesn't exist
   * @param name The name of the command being called
   * @param type The command type
   * @param interaction The interaction object
   */
  async handleContextMenu(
    name: string,
    type: 2 | 3,
    interaction: GetConnectorType<'ContextMenuCommandInteraction'>
  ) {
    const command =
      type === ApplicationCommandType.User
        ? this.userContextMenuMap.get(name)
        : this.messageContextMenuMap.get(name);
    if (!command) {
      return false;
    } else {
      this.logger?.info(`Running context command ${name}`);
      // @ts-expect-error This is fine
      this.contextMenuMiddleware.execute(command.run, interaction, this);
      return true;
    }
  }

  // #region Page component handlers
  public async handleComponentInteraction(
    interaction: GetConnectorType<'MessageComponentInteraction'>,
    messageId: string,
    customId: string
  ) {
    if (!customId.startsWith('~')) return;
    let page = this.activePages.get(messageId);
    if (!page) {
      page = await this.getPageFromMessage(messageId, interaction);
      if (!page) {
        return;
      }
      this.activePages.set(messageId, page);
      const renderedPage = await page.render();
      if (
        !compareMessages(
          this.connector.interactionToComparableMessage(interaction),
          renderedPage
        )
      ) {
        // await interaction.update({
        //   content: null,
        //   embeds: [],
        //   ...renderedPage,
        //   components: renderedPage.components
        //     ? pageComponentRowsToComponents(renderedPage.components, page)
        //     : [],
        //   fetchReply: true,
        //   flags: renderedPage.flags,
        // });
        // interaction.followUp({
        //   content:
        //     "An older version of this page was stored, it's been updated. Click the button you want again.",
        //   ephemeral: true,
        // });
        console.log('Old page');
        return;
      }
    }
    const message = page.message;
    if (message instanceof PageInteractionReplyMessage) {
      // If this page was an interaction reply (meaning it was ephemeral), update the interaction to extend the lifetime of the token
      page.message = new PageInteractionReplyMessage(
        this.connector.getModifiableWebhookFromInteraction(interaction),
        this.connector.getInteractionToken(interaction),
        message.messageId
      );
      // Store the updated page
      const state = await page.serializeState();
      this.storePageState(
        page.message.messageId,
        page.constructor.pageId,
        state,
        JSON.stringify(page.message.serialize())
      );
    }
    page.latestInteraction = interaction;
    await page.handleId(customId.split(';')[1], interaction as any);
  }

  // TODO redo this with connector
  // private async handlePageButton(
  //   interaction: GetConnectorType<'ButtonInteraction'>
  // ) {
  //   let page = this.activePages.get(interaction.message.id);
  //   if (!page) {
  //     page = await this.getPageFromMessage(interaction.message.id, interaction);
  //     if (!page) {
  //       return;
  //     }
  //     this.activePages.set(interaction.message.id, page);
  //     const renderedPage = await page.render();
  //     if (!compareMessages(interaction.message, renderedPage)) {
  //       await interaction.update({
  //         content: null,
  //         embeds: [],
  //         ...renderedPage,
  //         components: renderedPage.components
  //           ? pageComponentRowsToComponents(renderedPage.components, page)
  //           : [],
  //         fetchReply: true,
  //         flags: renderedPage.flags,
  //       });
  //       interaction.followUp({
  //         content:
  //           "An older version of this page was stored, it's been updated. Click the button you want again.",
  //         ephemeral: true,
  //       });
  //       return;
  //     }
  //   }
  //   const message = page.message;
  //   if (message instanceof PageInteractionReplyMessage) {
  //     // If this page was an interaction reply (meaning it was ephemeral), update the interaction to extend the lifetime of the token
  //     page.message = new PageInteractionReplyMessage(
  //       interaction.webhook,
  //       message.id
  //     );
  //     // Store the updated page
  //     const state = await page.serializeState();
  //     this.storePageState(
  //       page.message.id,
  //       page.constructor.pageId,
  //       state,
  //       this.connector.messageToMessageData(page.message)
  //     );
  //   }
  //   page.latestInteraction = interaction;
  //   page.handleId(interaction.data.custom_id.split(';')[1], interaction);
  // }

  // private async handlePageSelect(
  //   interaction: GetConnectorType<'SelectMenuInteraction'>
  // ) {
  //   let page = this.activePages.get(interaction.message.id);
  //   if (!page) {
  //     page = await this.getPageFromMessage(interaction.message.id, interaction);
  //     if (!page) {
  //       return;
  //     }
  //     this.activePages.set(interaction.message.id, page);
  //     const renderedPage = await page.render();
  //     if (!compareMessages(interaction.message, renderedPage)) {
  //       await interaction.update({
  //         ...renderedPage,
  //         components: renderedPage.components
  //           ? pageComponentRowsToComponents(renderedPage.components, page)
  //           : [],
  //         fetchReply: true,
  //         flags: renderedPage.flags,
  //       });
  //       interaction.followUp({
  //         content:
  //           "An older version of this page was stored, it's been updated. Make your selection again.",
  //         ephemeral: true,
  //       });
  //       return;
  //     }
  //   }
  //   const message = page.message;
  //   if (message instanceof PageInteractionReplyMessage) {
  //     // If this page was an interaction reply (meaning it was ephemeral), update the interaction to extend the lifetime of the token
  //     page.message = new PageInteractionReplyMessage(
  //       interaction.webhook,
  //       message.id
  //     );
  //     // Store the updated page
  //     const state = await page.serializeState();
  //     this.storePageState(
  //       page.message.id,
  //       page.constructor.pageId,
  //       state,
  //       this.connector.messageToMessageData(page.message)
  //     );
  //   }
  //   page.latestInteraction = interaction;
  //   page.handleId(interaction.data.custom_id.split(';')[1], interaction);
  // }

  // #region Modal handlers
  public async handleModalSubmit(
    customId: string,
    fields: Record<string, string>,
    interaction: GetConnectorType<'ModalSubmitInteraction'>
  ) {
    const modal = this.modalMap.get(customId);
    if (!modal) return;
    modal.handler(interaction, fields);
  }

  // #region More Page stuff
  async replyToInteractionWithPage<P, S>(
    page: Page<P, S>,
    interaction:
      | GetConnectorType<'MessageComponentInteraction'>
      | GetConnectorType<'CommandInteraction'>,
    ephemeral: boolean
  ) {
    const messageOptions = await page.render();
    // We need to save the interaction instead since it doesn't return a message we can edit
    const { messageId } = await this.connector.replyToInteraction(interaction, {
      ...messageOptions,
      content: messageOptions.content ?? undefined,
      components: messageOptions.components
        ? pageComponentRowsToComponents(messageOptions.components, page)
        : [],
      flags: ephemeral
        ? (messageOptions.flags ?? 0) | MessageFlags.Ephemeral
        : messageOptions.flags ?? 0,
    } as any);
    page.message = new PageInteractionReplyMessage(
      this.connector.getModifiableWebhookFromInteraction(interaction),
      this.connector.getInteractionToken(interaction),
      messageId
    );
    const state = await page.serializeState();
    this.storePageState(
      messageId,
      page.constructor.pageId,
      state,
      JSON.stringify(page.message.serialize())
    );
    this.activePages.set(messageId, page);
    page.pageDidSend?.();
  }

  async sendPageToChannel<P, S>(page: Page<P, S>, channel_id: string) {
    const messageOptions = await page.render();
    const message = await this.connector.sendToChannel(channel_id, {
      ...messageOptions,
      content: messageOptions.content ?? undefined,
      components: messageOptions.components
        ? pageComponentRowsToComponents(messageOptions.components, page)
        : [],
    } as any);
    page.message = message;
    const state = await page.serializeState();
    this.storePageState(
      message.messageId,
      page.constructor.pageId,
      state,
      JSON.stringify(page.message)
    );
    this.activePages.set(message.messageId, page);
    page.pageDidSend?.();
  }

  // async sendPageToForumChannel<P, S>(
  //   page: Page<P, S>,
  //   postTitle: string,
  //   channel: ForumChannel
  // ) {
  //   const messageOptions = await page.render();
  //   const thread = await channel.threads.create({
  //     name: postTitle,
  //     message: {
  //       ...messageOptions,
  //       content: messageOptions.content ?? undefined,
  //       components: messageOptions.components
  //         ? pageComponentRowsToComponents(messageOptions.components, page)
  //         : [],
  //     },
  //   });
  //   page.message = thread.lastMessage!;
  //   const state = await page.serializeState();
  //   this.storePageState(
  //     thread.lastMessage!.id,
  //     page.constructor.pageId,
  //     state,
  //     messageToMessageData(page.message)
  //   );
  //   this.activePages.set(thread.lastMessage!.id, page);
  // }

  async updatePage<P, S>(page: Page<P, S>, newState: S) {
    if (!page.message)
      throw new Error('You cannot update a page before it has been sent');
    page.state = newState;
    const messageOptions = await page.render();
    const { message } = page;
    if (message instanceof PageInteractionReplyMessage) {
      let didUpdate = false;
      if (page.latestInteraction) {
        didUpdate = await this.connector.tryUpdate(page.latestInteraction, {
          ...messageOptions,
          components: messageOptions.components
            ? pageComponentRowsToComponents(messageOptions.components, page)
            : [],
        });
      }
      if (!didUpdate) {
        await message.edit({
          ...messageOptions,
          components: messageOptions.components
            ? pageComponentRowsToComponents(messageOptions.components, page)
            : [],
        });
      }
    } else {
      await this.connector.editMessage(message, {
        ...messageOptions,
        components: messageOptions.components
          ? pageComponentRowsToComponents(messageOptions.components, page)
          : [],
      });
    }
    const state = await page.serializeState();
    this.activePages.set(message.messageId, page);
    this.storePageState(
      page.message.messageId,
      page.constructor.pageId,
      state,
      JSON.stringify(
        page.message instanceof PageInteractionReplyMessage
          ? page.message.serialize()
          : page.message
      )
    );
  }

  async getPageFromMessage(
    messageId: string,
    interaction:
      | GetConnectorType<'MessageComponentInteraction'>
      | GetConnectorType<'CommandInteraction'>
      | GetConnectorType<'ModalSubmitInteraction'>
  ) {
    const cachedPage = this.activePages.get(messageId);
    if (!cachedPage) {
      const { pageId, stateString, messageData } = await this.getPageState(
        messageId
      );
      const parsedMessageData = JSON.parse(messageData) as
        | MessageData
        | InteractionMessageData;
      const message = await this.getMessage(parsedMessageData, interaction);
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
        this.connector.deleteMessage(parsedMessageData);
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
      this.activePages.set(messageId, newPage);
      return newPage;
    }
    return cachedPage;
  }

  private async getMessage(
    messageData: MessageData | InteractionMessageData,
    interaction:
      | GetConnectorType<'MessageComponentInteraction'>
      | GetConnectorType<'CommandInteraction'>
      | GetConnectorType<'ModalSubmitInteraction'>
  ) {
    if ('channelId' in messageData) {
      return messageData;
    } else {
      return new PageInteractionReplyMessage(
        this.connector.getModifiableWebhookFromInteraction(interaction),
        this.connector.getInteractionToken(interaction),
        messageData.messageId
      );
    }
  }
}
