import {z} from 'zod';

export const identitySchema=z.object({
 platform:z.literal('MT5'),
 collectorVersion:z.string().min(1).max(32),
 brokerServer:z.string().min(1).max(128),
 accountLogin:z.string().regex(/^[1-9][0-9]{0,19}$/),
 currency:z.string().min(1).max(12)
}).strict();

const amount=z.number().finite().min(-1e15).max(1e15);
const nonNegativeAmount=z.number().finite().min(0).max(1e15);
const sourceId=z.string().regex(/^[0-9]{1,20}$/);
const sourceTime=z.string().regex(/^[0-9]{1,20}$/);
const mt5Word=z.string().regex(/^[A-Za-z_]{1,32}$/);

const positionItemSchema=z.object({
 positionId:sourceId,
 ticket:sourceId,
 symbol:z.string().min(1).max(64),
 side:z.enum(['buy','sell']),
 volume:nonNegativeAmount,
 openPrice:nonNegativeAmount,
 currentPrice:nonNegativeAmount,
 stopLoss:nonNegativeAmount,
 takeProfit:nonNegativeAmount,
 openedAtMsc:sourceTime,
 updatedAtMsc:sourceTime,
 profit:amount,
 swap:amount
}).strict();

export const positionsSchema=z.object({
 frameId:z.string().min(1).max(64),
 capturedAt:z.iso.datetime(),
 pageIndex:z.number().int().min(0).max(127),
 pageCount:z.number().int().min(1).max(128),
 items:z.array(positionItemSchema).max(12)
}).strict().superRefine((value,ctx)=>{
 if(value.pageIndex>=value.pageCount)ctx.addIssue({code:'custom',message:'pageIndex must be smaller than pageCount',path:['pageIndex']});
});

const dealItemSchema=z.object({
 dealId:sourceId,
 orderId:sourceId,
 positionId:sourceId,
 timeMsc:sourceTime,
 symbol:z.string().max(64),
 dealType:z.enum(['buy','sell','buyCanceled','sellCanceled']),
 entry:z.enum(['out','outBy','inout']),
 reason:mt5Word,
 volume:nonNegativeAmount,
 price:nonNegativeAmount,
 profit:amount,
 commission:amount,
 swap:amount,
 fee:amount
}).strict();

export const dealsSchema=z.object({
 mode:z.literal('incremental'),
 baseCursor:z.object({timeMsc:sourceTime,ticket:sourceId}).strict().optional(),
 complete:z.boolean(),
 items:z.array(dealItemSchema).max(12)
}).strict();

const syncPayloadSchema=identitySchema.extend({
 snapshot:z.object({
  capturedAt:z.iso.datetime(),balance:amount,equity:amount,
  floatingPl:amount.optional(),margin:amount.optional(),freeMargin:amount.optional(),marginLevel:amount.optional()
 }).strict(),
 positions:positionsSchema.optional(),
 deals:dealsSchema.optional()
}).strict();

// A v0.200 collector sends only snapshot. v0.210 may attach one bounded trade-data section.
export const syncSchema=syncPayloadSchema.superRefine((value,ctx)=>{
 if(value.positions&&value.deals)ctx.addIssue({code:'custom',message:'positions and deals cannot be sent together',path:['deals']});
});

export const tokenPattern=/^BBP_[A-Za-z0-9_-]{43}$/;
export type Identity=z.infer<typeof identitySchema>;

