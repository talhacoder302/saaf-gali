import { model, models, Schema, type Model } from "mongoose";

// Named sequences (e.g. "receipt:<areaId>"). Incremented atomically with $inc,
// so two cashiers can never get the same number.
const counterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, required: true, default: 0 },
});

export type CounterDoc = { _id: string; seq: number };

export const Counter: Model<CounterDoc> =
  (models.Counter as Model<CounterDoc> | undefined) ?? model<CounterDoc>("Counter", counterSchema);
