export class ErrorHelper {
    static async warnOnFailure(action: () => Promise<void>, description: string): Promise<void> {
    try {
      await action();
    } catch (error) {
      console.warn(`[teardown] ${description} — failed, continuing: ${reasonFor(error)}`);
    }
  }

    static async eachWarnOnFailure<T>(
    items: readonly T[],
    action: (item: T) => Promise<void>,
    describe: (item: T) => string,
  ): Promise<T[]> {
    let failed: T[] = [];
    for (let item of items) {
      try {
        await action(item);
      } catch (error) {
        failed.push(item);
        console.warn(`[teardown] ${describe(item)} — failed, continuing: ${reasonFor(error)}`);
      }
    }
    return failed;
  }

    static async tryOrElse(primary: () => Promise<void>, fallback: () => Promise<void>): Promise<void> {
    try {
      await primary();
    } catch {
      await fallback();
    }
  }

    static async succeeded(action: () => Promise<void>): Promise<boolean> {
    try {
      await action();
      return true;
    } catch {
      return false;
    }
  }
}

function reasonFor(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
