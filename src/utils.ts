import { ApplicationCommand, ApplicationCommandData } from 'discord.js';

export function partitionCommands(
  oldCommands: ApplicationCommand[],
  newCommands: ApplicationCommandData[]
) {
  const added: ApplicationCommandData[] = [];
  const same: {
    oldCommand: ApplicationCommand;
    newCommand: ApplicationCommandData;
  }[] = [];
  const removed: ApplicationCommand[] = [];
  while (newCommands.length > 0) {
    const command = newCommands.pop()!;
    const matchIndex = oldCommands.findIndex(
      (old) => old.type === command?.type && old.name === command.name
    );
    if (matchIndex === -1) {
      added.push(command);
    } else {
      same.push({
        oldCommand: oldCommands.splice(matchIndex, 1)[0],
        newCommand: command,
      });
    }
  }
  oldCommands.forEach((old) => removed.push(old));

  return {
    added,
    same,
    removed,
  };
}
