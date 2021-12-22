"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlashCommand = exports.SlashCommandBase = void 0;
class SlashCommandBase {
    constructor(commandInfo) {
        this.commandInfo = commandInfo;
    }
}
exports.SlashCommandBase = SlashCommandBase;
function handlersHasAutocomplete(handlers) {
    return 'autocomplete' in handlers;
}
class SlashCommand {
    constructor(commandInfo, handlers) {
        const info = commandInfo;
        info.type = 'CHAT_INPUT';
        this.commandInfo = info;
        this.run = handlers.run;
        if (handlersHasAutocomplete(handlers))
            this.autocomplete = handlers.autocomplete;
    }
    run(interaction, _client, _options) {
        interaction.reply({
            content: 'This command is not implemented yet',
            ephemeral: true,
        });
    }
    autocomplete(interaction, _focusedName, _focusedValue, _client, _options) {
        interaction.respond([
            {
                name: "This interaction isn't implemented yet",
                value: 'error',
            },
        ]);
    }
}
exports.SlashCommand = SlashCommand;
//# sourceMappingURL=SlashCommandBase.js.map