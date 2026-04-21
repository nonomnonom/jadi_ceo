/**
 * Invoke a tool's `execute` in tests while bypassing the Mastra runtime's validation-error
 * branch and the required `context` parameter. Tests supply valid inputs, so the return is
 * always the success shape.
 */

import type { ValidationError } from '@mastra/core/tools';

// Strip the ValidationError branch from a tool's return union.
type ExtractSuccess<R> = R extends ValidationError ? never : R;

// biome-ignore lint/suspicious/noExplicitAny: generic tool helper needs structural any
type ToolExecFn = (input: any, context: any) => Promise<any>;
// Explicit `| undefined` so this matches under `exactOptionalPropertyTypes: true`
// (Mastra's Tool class declares `execute?: Fn` without `| undefined`, so TS views
// the absence differently under exact-optional).
type ToolLike = { execute?: ToolExecFn | undefined };

type ToolInput<T extends ToolLike> = NonNullable<T['execute']> extends (
  input: infer I,
  // biome-ignore lint/suspicious/noExplicitAny: generic tool helper needs structural any
  context: any,
  // biome-ignore lint/suspicious/noExplicitAny: generic tool helper needs structural any
) => any
  ? I
  : never;

type ToolOutput<T extends ToolLike> = NonNullable<T['execute']> extends (
  // biome-ignore lint/suspicious/noExplicitAny: generic tool helper needs structural any
  input: any,
  // biome-ignore lint/suspicious/noExplicitAny: generic tool helper needs structural any
  context: any,
) => Promise<infer R>
  ? ExtractSuccess<R>
  : never;

export async function runTool<T extends ToolLike>(
  tool: T,
  input: ToolInput<T>,
): Promise<ToolOutput<T>> {
  if (!tool.execute) throw new Error('tool has no execute function');
  const result = await tool.execute(input, {});
  return result as ToolOutput<T>;
}
