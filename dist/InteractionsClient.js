"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InteractionsClient = void 0;
const discord_js_1 = require("discord.js");
const path_1 = __importDefault(require("path"));
const require_all_1 = __importDefault(require("require-all"));
const utils_1 = require("./utils");
class InteractionsClient extends discord_js_1.Client {
    constructor(djsOptions, options) {
        super(djsOptions);
        this.commandMap = new Map();
        this.userContextMenuMap = new Map();
        this.messageContextMenuMap = new Map();
        this.logger = options.logger;
        this.devServerId = options.devServerId;
        this.onBeforeCommand = options.onBeforeCommand;
        this.onAfterCommand = options.onAfterCommand;
        this.onBeforeAutocomplete = options.onBeforeAutocomplete;
        this.onAfterAutocomplete = options.onAfterAutocomplete;
        this.on('interactionCreate', this.handleInteractionEvent);
    }
    async registerCommandsFrom(folderPath) {
        this.logger.info('Registering commands');
        const finalPath = folderPath.startsWith('.')
            ? path_1.default.join(__dirname, folderPath)
            : folderPath;
        var commands = (0, require_all_1.default)({
            dirname: finalPath,
        });
        const commandData = [];
        this.logger.debug(commands);
        this.addChatCommands(commands, commandData);
        this.addUserCommands(commands, commandData);
        this.addMessageCommands(commands, commandData);
        let manager;
        let oldCommands;
        if (process.env.NODE_ENV === 'development') {
            manager = this.guilds.cache.get(this.devServerId).commands;
            oldCommands = await manager.fetch();
        }
        else {
            manager = this.application.commands;
            oldCommands = await manager.fetch();
        }
        this.logger.info('Fetching old commands');
        const output = (0, utils_1.partitionCommands)(Array.from(oldCommands.values()), commandData);
        this.logger.debug(output.added);
        this.logger.debug(output.same);
        this.logger.debug(output.removed);
        if (output.same.length < 1) {
            manager.set(output.added);
        }
        else {
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
    addMessageCommands(commands, commandData) {
        if (commands.message) {
            for (const fileName in commands.message) {
                this.logger.debug(`Checking file ${fileName}`);
                const commandFile = commands.message[fileName];
                this.logger.debug(commandFile);
                if (commandFile.command) {
                    const command = commandFile.command;
                    this.messageContextMenuMap.set(command.commandInfo.name, command);
                    commandData.push(command.commandInfo);
                    this.logger.info(`Added message context command ${command.commandInfo.name} to command data list for registering`);
                }
                else {
                    this.logger.error(`Command file ${fileName} did not have an export named command`, commandFile);
                }
            }
        }
    }
    addUserCommands(commands, commandData) {
        if (commands.user) {
            for (const fileName in commands.user) {
                this.logger.debug(`Checking file ${fileName}`);
                const commandFile = commands.user[fileName];
                this.logger.debug(commandFile);
                if (commandFile.command) {
                    const command = commandFile.command;
                    this.userContextMenuMap.set(command.commandInfo.name, command);
                    commandData.push(command.commandInfo);
                    this.logger.info(`Added user context command ${command.commandInfo.name} to command data list for registering`);
                }
                else {
                    this.logger.error(`Command file ${fileName} did not have an export named command`, commandFile);
                }
            }
        }
    }
    addChatCommands(commands, commandData) {
        if (commands.chat) {
            for (const fileName in commands.chat) {
                this.logger.debug(`Checking file ${fileName}`);
                const commandFile = commands.chat[fileName];
                this.logger.debug(commandFile);
                if (commandFile.command) {
                    const command = commandFile.command;
                    this.commandMap.set(command.commandInfo.name, command);
                    commandData.push(command.commandInfo);
                    this.logger.info(`Added command ${command.commandInfo.name} to command data list for registering`);
                }
                else {
                    this.logger.error(`Command file ${fileName} did not have an export named command or a file named group`, commandFile);
                }
            }
        }
    }
    handleInteractionEvent(interaction) {
        this.logger.debug(interaction);
        if (interaction.isCommand()) {
            this.handleCommand(interaction);
            this.emit('commandRun', interaction);
        }
        else if (interaction.isButton()) {
            this.emit('buttonPressed', interaction);
        }
        else if (interaction.isSelectMenu()) {
            this.emit('selectChanged', interaction);
        }
        else if (interaction.isContextMenu()) {
            this.handleContextMenu(interaction);
            this.emit('contextMenuRun', interaction);
        }
        else if (interaction.isAutocomplete()) {
            this.handleAutocomplete(interaction);
            this.emit('autocomplete', interaction);
        }
    }
    async handleCommand(interaction) {
        const commandName = interaction.commandName;
        const command = this.commandMap.get(commandName);
        if (!command) {
            this.logger.error(`Unregistered command ${commandName} being run`);
            interaction.reply({
                content: 'There appears to be an issue with this command',
                ephemeral: true,
            });
        }
        else {
            this.logger.info(`Running command ${commandName}`);
            const data = interaction.options.data;
            const optionsObj = {};
            data.forEach((option) => {
                var _a, _b, _c, _d, _e;
                optionsObj[option.name] =
                    (_e = (_d = (_c = (_b = (_a = option.channel) !== null && _a !== void 0 ? _a : option.member) !== null && _b !== void 0 ? _b : option.message) !== null && _c !== void 0 ? _c : option.role) !== null && _d !== void 0 ? _d : option.user) !== null && _e !== void 0 ? _e : option.value;
            });
            if (this.onBeforeCommand) {
                this.onBeforeCommand(interaction, optionsObj);
            }
            await command.run(interaction, this, optionsObj);
            if (this.onAfterCommand) {
                this.onAfterCommand(interaction, optionsObj);
            }
        }
    }
    async handleAutocomplete(interaction) {
        const commandName = interaction.commandName;
        const command = this.commandMap.get(commandName);
        if (!command) {
            interaction.respond([]);
        }
        else {
            const data = interaction.options.data;
            const optionsObj = {};
            data.forEach((option) => {
                var _a, _b, _c, _d, _e;
                optionsObj[option.name] =
                    (_e = (_d = (_c = (_b = (_a = option.channel) !== null && _a !== void 0 ? _a : option.member) !== null && _b !== void 0 ? _b : option.message) !== null && _c !== void 0 ? _c : option.role) !== null && _d !== void 0 ? _d : option.user) !== null && _e !== void 0 ? _e : option.value;
            });
            const focused = interaction.options.getFocused(true);
            if (this.onBeforeAutocomplete) {
                this.onBeforeAutocomplete(interaction, focused.name, focused.value, optionsObj);
            }
            command.autocomplete(interaction, focused.name, focused.value, this, optionsObj);
            if (this.onAfterAutocomplete) {
                this.onAfterAutocomplete(interaction, focused.name, focused.value, optionsObj);
            }
        }
    }
    async handleContextMenu(interaction) {
        const commandName = interaction.commandName;
        const command = interaction.targetType === 'MESSAGE'
            ? this.messageContextMenuMap.get(commandName)
            : this.userContextMenuMap.get(commandName);
        if (!command) {
            this.logger.error(`Unregistered context command ${commandName} being run`);
            interaction.reply({
                content: 'There appears to be an issue with this command',
                ephemeral: true,
            });
        }
        else {
            this.logger.info(`Running context command ${commandName}`);
            command.run(interaction, this);
        }
    }
}
exports.InteractionsClient = InteractionsClient;
//# sourceMappingURL=InteractionsClient.js.map