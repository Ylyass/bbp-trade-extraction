import {z} from 'zod';
export const identitySchema=z.object({platform:z.literal('MT5'),collectorVersion:z.string().min(1).max(32),brokerServer:z.string().min(1).max(128),accountLogin:z.string().regex(/^[1-9][0-9]{0,19}$/),currency:z.string().min(1).max(12)}).strict();
const amount=z.number().finite().min(-1e15).max(1e15);
export const syncSchema=identitySchema.extend({snapshot:z.object({capturedAt:z.iso.datetime(),balance:amount,equity:amount}).strict()}).strict();
export const tokenPattern=/^BBP_[A-Za-z0-9_-]{43}$/;
export type Identity=z.infer<typeof identitySchema>;

