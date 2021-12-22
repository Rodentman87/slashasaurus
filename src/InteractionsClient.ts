import {
  ApplicationCommand,
  ApplicationCommandData,
  ApplicationCommandManager,
  AutocompleteInteraction,
  Awaited,
  ButtonInteraction,
  ChatInputApplicationCommandData,
  Client,
  ClientEvents,
  ClientOptions,
  Collection,
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
import { SlashCommandBase, SlashCommand } from './SlashCommandBase';
import { partitionCommands } from './utils';

interface IntercationsClientEvents extends ClientEvents {
  commandRun: [intercation: CommandInteraction];
  buttonPressed: [interaction: ButtonInteraction];
  selectChanged: [interaction: SelectMenuInteraction];
  contextMenuRun: [interaction: ContextMenuInteraction];
  autocomplete: [interaction: AutocompleteInteraction];
}

export declare interface InteractionsClient<T, U> extends Client {
  on<K extends keyof IntercationsClientEvents>(
    event: K,
    listener: (...args: IntercationsClientEvents[K]) => Awaited<void>
  ): this;

  once<K extends keyof IntercationsClientEvents>(
    event: K,
    listener: (...args: IntercationsClientEvents[K]) => Awaited<void>
  ): this;

  emit<K extends keyof IntercationsClientEvents>(
    event: K,
    ...args: IntercationsClientEvents[K]
  ): boolean;

  off<K extends keyof IntercationsClientEvents>(
    event: K,
    listener: (...args: IntercationsClientEvents[K]) => Awaited<void>
  ): this;

  removeAllListeners<K extends keyof IntercationsClientEvents>(event?: K): this;
}

export interface InteractionsClientOptions<T, U> {
  /**
   * You can pass any logger compatible with [pino]{@link https://getpino.io/#/}
   * and the client will log some internal information to it
   */
  logger: Logger;

  /**
   * This will be used to register guild commands when running the bot
   * in development
   */
  devServerId: string;

  /**
   * If specified, this will run just before a command handler is called.
   * You can use this to run logging or similar like adding sentry
   * breadcrumbs.
   *
   * The returned object will be passed as the extra value to onAfterCommand
   */
  onBeforeCommand?: (
    interaction: CommandInteraction,
    optionsObj: Record<string, any>
  ) => T;

  /**
   * If specified, this will run just after a command handler is called.
   * You can use this to run cleanup of anything you set up in
   * onBeforeCommand.
   *
   * @param extra This is the object you returned from onBeforeCommand
   */
  onAfterCommand?: (
    interaction: CommandInteraction,
    optionsObj: Record<string, any>,
    extra?: T
  ) => void;

  /**
   * If specified, this will run just after a command handler is called if
   * the command failed. You can use this to run cleanup of anything you
   * set up in onBeforeCommand.
   *
   * @param extra This is the object you returned from onBeforeCommand
   */
  onCommandFailed?: (
    interaction: CommandInteraction,
    optionsObj: Record<string, any>,
    error: any,
    extra?: T
  ) => void;

  /**
   * If specified, this will run just before an autocomplete handler is
   * called. You can use this to run logging or similar like adding sentry
   * breadcrumbs.
   *
   * The returned object will be passed as the extra value to
   * onAfterAutocomplete
   */
  onBeforeAutocomplete?: (
    interaction: AutocompleteInteraction,
    focusedName: string,
    focusedValue: string | number,
    optionsObj: Record<string, any>
  ) => U;

  /**
   * If specified, this will run just after an autocomplete handler is
   * called. You can use this to run cleanup of anything you set up in
   * onBeforeAutocomplete.
   *
   * @param extra This is the object you returned from
   * onBeforeAutocomplete
   */
  onAfterAutocomplete?: (
    interaction: AutocompleteInteraction,
    focusedName: string,
    focusedValue: string | number,
    optionsObj: Record<string, any>,
    extra?: U
  ) => void;

  /**
   * If specified, this will run just after an autocomplete handler is
   * called if it throws an error. You can use this to run cleanup of
   * anything you set up in onBeforeAutocomplete.
   *
   * @param extra This is the object you returned from
   * onBeforeAutocomplete
   */
  onAutocompleteFailed?: (
    interaction: AutocompleteInteraction,
    focusedName: string,
    focusedValue: string | number,
    optionsObj: Record<string, any>,
    error: any,
    extra?: U
  ) => void;
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

export class InteractionsClient<T, U> extends Client {
  commandMap = new Map<string, SlashCommandBase<any>>();
  userContextMenuMap = new Map<string, ContextMenuBase>();
  messageContextMenuMap = new Map<string, ContextMenuBase>();
  logger: Logger;
  devServerId: string;
  onBeforeCommand?: (
    interaction: CommandInteraction,
    optionsObj: Record<string, any>
  ) => T;
  onAfterCommand?: (
    interaction: CommandInteraction,
    optionsObj: Record<string, any>,
    extra?: T
  ) => void;
  onCommandFailed?: (
    interaction: CommandInteraction,
    optionsObj: Record<string, any>,
    error: any,
    extra?: T
  ) => void;
  onBeforeAutocomplete?: (
    interaction: AutocompleteInteraction,
    focusedName: string,
    focusedValue: string | number,
    optionsObj: Record<string, any>
  ) => U;
  onAfterAutocomplete?: (
    interaction: AutocompleteInteraction,
    focusedName: string,
    focusedValue: string | number,
    optionsObj: Record<string, any>,
    extra?: U
  ) => void;
  onAutocompleteFailed?: (
    interaction: AutocompleteInteraction,
    focusedName: string,
    focusedValue: string | number,
    optionsObj: Record<string, any>,
    error: any,
    extra?: U
  ) => void;

  constructor(
    djsOptions: ClientOptions,
    options: InteractionsClientOptions<T, U>
  ) {
    super(djsOptions);
    this.logger = options.logger;
    this.devServerId = options.devServerId;
    this.onBeforeCommand = options.onBeforeCommand;
    this.onAfterCommand = options.onAfterCommand;
    this.onCommandFailed = options.onCommandFailed;
    this.onBeforeAutocomplete = options.onBeforeAutocomplete;
    this.onAfterAutocomplete = options.onAfterAutocomplete;
    this.onAutocompleteFailed = options.onAutocompleteFailed;
    this.on('interactionCreate', this.handleInteractionEvent);
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
    let oldCommands: Collection<string, ApplicationCommand>;
    if (process.env.NODE_ENV === 'development') {
      manager = this.guilds.cache.get(this.devServerId)!.commands;
      oldCommands = await manager.fetch();
    } else {
      manager = this.application!.commands;
      oldCommands = await manager.fetch();
    }

    this.logger.info('Fetching old commands');
    const output = partitionCommands(
      Array.from(oldCommands!.values()),
      commandData
    );
    this.logger.debug(output.added);
    this.logger.debug(output.same);
    this.logger.debug(output.removed);

    if (output.same.length < 1) {
      // All the commands are new
      manager.set(output.added);
    } else {
      // We need to update stuff the hard way
      output.added.forEach((newCommand) => {
        manager.create(newCommand);
      });
      output.removed.forEach((oldCommand) => {
        manager.delete(oldCommand);
      });
      output.same.forEach(({ oldCommand, newCommand }) => {
        if (!oldCommand.equals(newCommand))
          manager.edit(oldCommand, newCommand);
      });
    }
    this.logger.info('Finished registering commands');
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
          const command = commandFile.command as
            | SlashCommandBase<any>
            | SlashCommand<any, any>;
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

  async handleCommand(interaction: CommandInteraction) {
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
      let extra;
      if (this.onBeforeCommand) {
        extra = this.onBeforeCommand(interaction, optionsObj);
      }
      try {
        await command.run(interaction, this, optionsObj as any);
        if (this.onAfterCommand) {
          this.onAfterCommand(interaction, optionsObj, extra);
        }
      } catch (e) {
        if (this.onCommandFailed) {
          this.onCommandFailed(interaction, optionsObj, e, extra);
        } else {
          throw e;
        }
      }
    }
  }

  async handleAutocomplete(interaction: AutocompleteInteraction) {
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
      let extra;
      if (this.onBeforeAutocomplete) {
        extra = this.onBeforeAutocomplete(
          interaction,
          focused.name,
          focused.value,
          optionsObj
        );
      }
      try {
        await command.autocomplete(
          interaction,
          focused.name,
          focused.value,
          this,
          optionsObj as any
        );
        if (this.onAfterAutocomplete) {
          this.onAfterAutocomplete(
            interaction,
            focused.name,
            focused.value,
            optionsObj,
            extra
          );
        }
      } catch (e) {
        if (this.onAutocompleteFailed) {
          this.onAutocompleteFailed(
            interaction,
            focused.name,
            focused.value,
            optionsObj,
            e,
            extra
          );
        } else {
          throw e;
        }
      }
    }
  }

  async handleContextMenu(interaction: ContextMenuInteraction) {
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
