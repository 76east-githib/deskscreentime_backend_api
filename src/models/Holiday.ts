import mongoose from "mongoose";
const { Schema } = mongoose;

const holidaySchema = new Schema(
  {
    holidayName: { type: String, trim: true, required: true, index: true },
    holidayDate: { type: Date, required: true, index: true },
  },
  {
    strict: true,
    timestamps: true,
  }
);

holidaySchema.pre("save", function (next: any) {
  next();
});

const Holiday =
  (mongoose.models && mongoose.models.Holiday) ||
  mongoose.model("Holiday", holidaySchema);

export default Holiday;
