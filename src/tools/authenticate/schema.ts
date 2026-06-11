import { z } from 'zod';

export const schema = z.object({});

export type Input = z.infer<typeof schema>;
