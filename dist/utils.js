"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.partitionCommands = void 0;
function partitionCommands(oldCommands, newCommands) {
    const added = [];
    const same = [];
    const removed = [];
    while (newCommands.length > 0) {
        const command = newCommands.pop();
        const matchIndex = oldCommands.findIndex((old) => old.type === (command === null || command === void 0 ? void 0 : command.type) && old.name === command.name);
        if (matchIndex === -1) {
            added.push(command);
        }
        else {
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
exports.partitionCommands = partitionCommands;
//# sourceMappingURL=utils.js.map