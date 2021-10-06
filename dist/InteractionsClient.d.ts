import { AutocompleteInteraction, Awaited, ButtonInteraction, Client, ClientEvents, ClientOptions, CommandInteraction, ContextMenuInteraction, Interaction, SelectMenuInteraction } from 'discord.js';
import { Logger } from 'pino';
import { ContextMenuBase } from './ContextMenuBase';
import { SlashCommandBase } from './SlashCommandBase';
interface IntercationsClientEvents extends ClientEvents {
    commandRun: [intercation: CommandInteraction];
    buttonPressed: [interaction: ButtonInteraction];
    selectChanged: [interaction: SelectMenuInteraction];
    contextMenuRun: [interaction: ContextMenuInteraction];
    autocomplete: [interaction: AutocompleteInteraction];
}
export declare interface InteractionsClient extends Client {
    on<K extends keyof IntercationsClientEvents>(event: K, listener: (...args: IntercationsClientEvents[K]) => Awaited<void>): this;
    once<K extends keyof IntercationsClientEvents>(event: K, listener: (...args: IntercationsClientEvents[K]) => Awaited<void>): this;
    emit<K extends keyof IntercationsClientEvents>(event: K, ...args: IntercationsClientEvents[K]): boolean;
    off<K extends keyof IntercationsClientEvents>(event: K, listener: (...args: IntercationsClientEvents[K]) => Awaited<void>): this;
    removeAllListeners<K extends keyof IntercationsClientEvents>(event?: K): this;
}
export declare class InteractionsClient extends Client {
    commandMap: Map<string, SlashCommandBase<any>>;
    userContextMenuMap: Map<string, ContextMenuBase>;
    messageContextMenuMap: Map<string, ContextMenuBase>;
    logger: Logger;
    devServerId: string;
    constructor(options: ClientOptions, logger: Logger, devServerId: string);
    registerCommandsFrom(folderPath: string): Promise<void>;
    private addMessageCommands;
    private addUserCommands;
    private addChatCommands;
    handleInteractionEvent(interaction: Interaction): void;
    handleCommand(interaction: CommandInteraction): Promise<void>;
    handleAutocomplet(interaction: AutocompleteInteraction): Promise<void>;
    handleContextMenu(interaction: ContextMenuInteraction): Promise<void>;
}
export {};
