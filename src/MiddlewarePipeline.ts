// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Middleware<T extends (...args: any[]) => any> = (
  ...args: [...Parameters<T>, () => Promise<void>]
) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class Pipeline<T extends (...args: any[]) => any> {
  stack: Array<Middleware<T>>;

  constructor() {
    this.stack = [];
  }

  push(fn: Middleware<T>) {
    this.stack.push(fn);
  }

  async execute(lastFunction: T, ...args: Parameters<T>) {
    let previousIndex = -1;

    const runner = async (index: number) => {
      if (index === previousIndex) {
        throw new Error(`next() can only be called once per middleware`);
      }

      if (index >= this.stack.length) {
        // We've reached the end, run the last function
        await lastFunction(...args);
      }

      previousIndex = index;

      const middleware = this.stack[index];

      if (middleware) {
        await middleware(...args, () => {
          return runner(index + 1);
        });
      }
    };

    await runner(0);
  }
}
