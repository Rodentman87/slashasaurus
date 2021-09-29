import {
  ApplicationCommand,
  ApplicationCommandData,
  ApplicationCommandManager,
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
import { Logger } from 'pino';
import requireAll from 'require-all';
import { ContextMenuBase } from './ContextMenuBase';
import { SlashCommandBase } from './SlashCommandBase';
import { partitionCommands } from './utils';

interface IntercationsClientEvents extends ClientEvents {
  commandRun: [intercation: CommandInteraction];
  buttonPressed: [interaction: ButtonInteraction];
  selectChanged: [interaction: SelectMenuInteraction];
  contextMenuRun: [interaction: ContextMenuInteraction];
}

export declare interface InteractionsClient extends Client {
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

export class InteractionsClient extends Client {
  commandMap = new Map<string, SlashCommandBase>();
  userContextMenuMap = new Map<string, ContextMenuBase>();
  messageContextMenuMap = new Map<string, ContextMenuBase>();
  logger: Logger;
  devServerId: string;

  constructor(options: ClientOptions, logger: Logger, devServerId: string) {
    super(options);
    this.logger = logger;
    this.devServerId = devServerId;
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
        let shouldBeUpdated = false;
        if (
          newCommand.type === 'CHAT_INPUT' &&
          oldCommand.description !== newCommand.description
        ) {
          shouldBeUpdated = true;
        }
        if (
          newCommand.type === 'CHAT_INPUT' &&
          JSON.stringify(oldCommand.options) !==
            JSON.stringify(newCommand.options)
        ) {
          shouldBeUpdated = true;
        }
        if (shouldBeUpdated) manager.edit(oldCommand, newCommand);
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
          const command = commandFile.command as SlashCommandBase;
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
    }
  }

  async handleCommand(interaction: CommandInteraction) {
    const commandName = interaction.commandName;
    const command = this.commandMap.get(commandName);
    if (!command) {
      this.logger.error(`Unregistered command ${commandName} being run`);
      interaction.reply({
        content:
          'There appears to be an issue with this command, contact `Rodentman87#8787` about this',
        ephemeral: true,
      });
    } else {
      this.logger.info(`Running command ${commandName}`);
      command.run(interaction, this);
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
        content:
          'There appears to be an issue with this command, contact `Rodentman87#8787` about this',
        ephemeral: true,
      });
    } else {
      this.logger.info(`Running context command ${commandName}`);
      command.run(interaction, this);
    }
  }
}
