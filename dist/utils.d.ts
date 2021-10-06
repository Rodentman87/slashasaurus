import { ApplicationCommand, ApplicationCommandData } from 'discord.js';
export declare function partitionCommands(oldCommands: ApplicationCommand[], newCommands: ApplicationCommandData[]): {
    added: ApplicationCommandData[];
    same: {
        oldCommand: ApplicationCommand;
        newCommand: ApplicationCommandData;
    }[];
    removed: ApplicationCommand<{}>[];
};
