import type { z } from "zod";

export function fn<TSchema extends z.ZodTypeAny, TOutput>(
  schema: TSchema,
  handler: (input: z.infer<TSchema>) => Promise<TOutput>,
) {
  const wrapped = (input: z.infer<TSchema>) => {
    const parsed = schema.parse(input);
    return handler(parsed);
  };
  wrapped.schema = schema;
  return wrapped;
}
