import {
  ApplicationCommandData,
  ApplicationCommandManager,
  AutocompleteInteraction,
  Awaitable,
  ButtonInteraction,
  ChatInputApplicationCommandData,
  Client,
  ClientEvents,
  ClientOptions,
  CommandInteraction,
  ContextMenuInteraction,
  GuildApplicationCommandManager,
  Interaction,
  MessageApplicationCommandData,
  SelectMenuInteraction,
  UserApplicationCommandData,
} from 'discord.js';
import path from 'path';
import requireAll from 'require-all';
import { ContextMenuBase } from './ContextMenuBase';
import { Pipeline, Middleware } from './MiddlewarePipeline';
import {
  SlashCommand,
  CommandRunFunction,
  AutocompleteFunction,
} from './SlashCommandBase';

interface IntercationsClientEvents extends ClientEvents {
  commandRun: [intercation: CommandInteraction];
  buttonPressed: [interaction: ButtonInteraction];
  selectChanged: [interaction: SelectMenuInteraction];
  contextMenuRun: [interaction: ContextMenuInteraction];
  autocomplete: [interaction: AutocompleteInteraction];
}

export declare interface InteractionsClient extends Client {
  on<K extends keyof IntercationsClientEvents>(
    event: K,
    listener: (...args: IntercationsClientEvents[K]) => Awaitable<void>
  ): this;

  once<K extends keyof IntercationsClientEvents>(
    event: K,
    listener: (...args: IntercationsClientEvents[K]) => Awaitable<void>
  ): this;

  emit<K extends keyof IntercationsClientEvents>(
    event: K,
    ...args: IntercationsClientEvents[K]
  ): boolean;

  off<K extends keyof IntercationsClientEvents>(
    event: K,
    listener: (...args: IntercationsClientEvents[K]) => Awaitable<void>
  ): this;

  removeAllListeners<K extends keyof IntercationsClientEvents>(event?: K): this;
}

export interface InteractionsClientOptions {
  /**
   * You can pass any logger compatible with [pino](https://getpino.io/)
   * and the client will log some internal information to it
   */
  logger: Logger;

  /**
   * This will be used to register guild commands when running the bot
   * in development
   */
  devServerId: string;
}

interface LogFn {
  /* tslint:disable:no-unnecessary-generics */
  <T extends object>(obj: T, msg?: string, ...args: any[]): void;
  (msg: string, ...args: any[]): void;
}

export interface Logger {
  info: LogFn;
  debug: LogFn;
  error: LogFn;
}

export class InteractionsClient extends Client {
  commandMap = new Map<string, SlashCommand<any>>();
  userContextMenuMap = new Map<string, ContextMenuBase>();
  messageContextMenuMap = new Map<string, ContextMenuBase>();
  logger: Logger;
  devServerId: string;
  chatCommandMiddleware: Pipeline<CommandRunFunction<readonly [], this>>;
  autocompleteMiddleware: Pipeline<AutocompleteFunction<readonly [], this>>;

  constructor(djsOptions: ClientOptions, options: InteractionsClientOptions) {
    super(djsOptions);
    this.logger = options.logger;
    this.devServerId = options.devServerId;
    this.on('interactionCreate', this.handleInteractionEvent);
    this.chatCommandMiddleware = new Pipeline();
    this.autocompleteMiddleware = new Pipeline();
  }

  /**
   * Registers all command files in the given path
   *
   * @param folderPath The relative path to the folder
   */
  async registerCommandsFrom(folderPath: string) {
    this.logger.info('Registering commands');
    const finalPath = folderPath.startsWith('.')
      ? path.join(__dirname, folderPath)
      : folderPath;
    var commands = requireAll({
      dirname: finalPath,
    });
    const commandData: ApplicationCommandData[] = [];

    this.logger.debug(commands);

    this.addChatCommands(commands, commandData);
    this.addUserCommands(commands, commandData);
    this.addMessageCommands(commands, commandData);

    let manager: ApplicationCommandManager | GuildApplicationCommandManager;
    if (process.env.NODE_ENV === 'development') {
      manager = this.guilds.cache.get(this.devServerId)!.commands;
    } else {
      manager = this.application!.commands;
    }

    manager.set(commandData);

    this.logger.info('Finished registering commands');
  }

  useCommandMiddleware(fn: Middleware<CommandRunFunction<readonly [], this>>) {
    this.chatCommandMiddleware.push(fn);
  }

  useAutocompleteMiddleware(
    fn: Middleware<AutocompleteFunction<readonly [], this>>
  ) {
    this.autocompleteMiddleware.push(fn);
  }

  private addMessageCommands(
    commands: { [key: string]: any },
    commandData: (
      | ChatInputApplicationCommandData
      | UserApplicationCommandData
      | MessageApplicationCommandData
    )[]
  ) {
    if (commands.message) {
      for (const fileName in commands.message) {
        this.logger.debug(`Checking file ${fileName}`);
        const commandFile = commands.message[fileName];
        this.logger.debug(commandFile);
        if (commandFile.command) {
          const command = commandFile.command as ContextMenuBase;
          this.messageContextMenuMap.set(command.commandInfo.name, command);
          commandData.push(command.commandInfo);
          this.logger.info(
            `Added message context command ${command.commandInfo.name} to command data list for registering`
          );
        } else {
          this.logger.error(
            `Command file ${fileName} did not have an export named command`,
            commandFile
          );
        }
      }
    }
  }

  private addUserCommands(
    commands: { [key: string]: any },
    commandData: (
      | ChatInputApplicationCommandData
      | UserApplicationCommandData
      | MessageApplicationCommandData
    )[]
  ) {
    if (commands.user) {
      for (const fileName in commands.user) {
        this.logger.debug(`Checking file ${fileName}`);
        const commandFile = commands.user[fileName];
        this.logger.debug(commandFile);
        if (commandFile.command) {
          const command = commandFile.command as ContextMenuBase;
          this.userContextMenuMap.set(command.commandInfo.name, command);
          commandData.push(command.commandInfo);
          this.logger.info(
            `Added user context command ${command.commandInfo.name} to command data list for registering`
          );
        } else {
          this.logger.error(
            `Command file ${fileName} did not have an export named command`,
            commandFile
          );
        }
      }
    }
  }

  private addChatCommands(
    commands: { [key: string]: any },
    commandData: (
      | ChatInputApplicationCommandData
      | UserApplicationCommandData
      | MessageApplicationCommandData
    )[]
  ) {
    if (commands.chat) {
      for (const fileName in commands.chat) {
        this.logger.debug(`Checking file ${fileName}`);
        const commandFile = commands.chat[fileName];
        this.logger.debug(commandFile);
        if (commandFile.command) {
          // This is a basic command
          const command = commandFile.command as SlashCommand<any, any>;
          // @ts-ignore
          this.commandMap.set(command.commandInfo.name, command);
          commandData.push(command.commandInfo);
          this.logger.info(
            `Added command ${command.commandInfo.name} to command data list for registering`
          );
          // } else if (commandFile.group) {
          //   // This is a command group
          //   this.logger.info(`Loading command group ${fileName}`);
          //   if (commandFile.group.group) {
          //     const group = commandFile.group.group as CommandGroup;
          //     this.commandMap.set(group.commandInfo.name, group);
          //     commandData.push({
          //       ...group.commandInfo,
          //       options: group.getOptions(commandFile, this),
          //     });
          //     this.logger.info(
          //       `Added command ${group.commandInfo.name} to command data list for registering`
          //     );
          //   } else {
          //     this.logger.error(
          //       `Command group ${fileName} does not have an export named group`
          //     );
          //   }
          //
        } else {
          this.logger.error(
            `Command file ${fileName} did not have an export named command or a file named group`,
            commandFile
          );
        }
      }
    }
  }

  handleInteractionEvent(interaction: Interaction) {
    this.logger.debug(interaction);
    if (interaction.isCommand()) {
      // This is a command, pass it to our command handlers
      this.handleCommand(interaction);
      this.emit('commandRun', interaction);
    } else if (interaction.isButton()) {
      this.emit('buttonPressed', interaction);
    } else if (interaction.isSelectMenu()) {
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
    const commandName = interaction.commandName;
    const command = this.commandMap.get(commandName);
    if (!command) {
      this.logger.error(`Unregistered command ${commandName} being run`);
      interaction.reply({
        content: 'There appears to be an issue with this command',
        ephemeral: true,
      });
    } else {
      this.logger.info(`Running command ${commandName}`);
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
      await this.autocompleteMiddleware.execute(
        command.autocomplete,
        interaction,
        // @ts-expect-error The type here will be `never` but that's because we're using generics dumb
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
      this.logger.error(
        `Unregistered context command ${commandName} being run`
      );
      interaction.reply({
        content: 'There appears to be an issue with this command',
        ephemeral: true,
      });
    } else {
      this.logger.info(`Running context command ${commandName}`);
      command.run(interaction, this);
    }
  }
}
