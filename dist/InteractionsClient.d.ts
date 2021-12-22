import { AutocompleteInteraction, Awaited, ButtonInteraction, Client, ClientEvents, ClientOptions, CommandInteraction, ContextMenuInteraction, Interaction, SelectMenuInteraction } from 'discord.js';
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
export interface InteractionsClientOptions {
    logger: Logger;
    devServerId: string;
    onBeforeCommand?: (interaction: CommandInteraction, optionsObj: Record<string, any>) => void;
    onAfterCommand?: (interaction: CommandInteraction, optionsObj: Record<string, any>) => void;
    onBeforeAutocomplete?: (interaction: AutocompleteInteraction, focusedName: string, focusedValue: string | number, optionsObj: Record<string, any>) => void;
    onAfterAutocomplete?: (interaction: AutocompleteInteraction, focusedName: string, focusedValue: string | number, optionsObj: Record<string, any>) => void;
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
export declare class InteractionsClient extends Client {
    commandMap: Map<string, SlashCommandBase<any>>;
    userContextMenuMap: Map<string, ContextMenuBase>;
    messageContextMenuMap: Map<string, ContextMenuBase>;
    logger: Logger;
    devServerId: string;
    onBeforeCommand?: (interaction: CommandInteraction, optionsObj: Record<string, any>) => void;
    onAfterCommand?: (interaction: CommandInteraction, optionsObj: Record<string, any>) => void;
    onBeforeAutocomplete?: (interaction: AutocompleteInteraction, focusedName: string, focusedValue: string | number, optionsObj: Record<string, any>) => void;
    onAfterAutocomplete?: (interaction: AutocompleteInteraction, focusedName: string, focusedValue: string | number, optionsObj: Record<string, any>) => void;
    constructor(djsOptions: ClientOptions, options: InteractionsClientOptions);
    registerCommandsFrom(folderPath: string): Promise<void>;
    private addMessageCommands;
    private addUserCommands;
    private addChatCommands;
    handleInteractionEvent(interaction: Interaction): void;
    handleCommand(interaction: CommandInteraction): Promise<void>;
    handleAutocomplete(interaction: AutocompleteInteraction): Promise<void>;
    handleContextMenu(interaction: ContextMenuInteraction): Promise<void>;
}
export {};
