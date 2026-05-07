import mongoose from "mongoose";
const { Schema } = mongoose;

const AdditionalLeaveSchema = new Schema(
  {
    userId: { type: Schema.ObjectId, ref: "Users" ,index: true},
    leaveFrom: { type: Date, required: true },
    leaveTo: { type: Date, required: true },
    remark: { type: String, trim: true, required: true },
    leaveType: { type: String, trim: true },
    leaveDuration: {
      type: String,
      enum: ["halfleave", "fullleave", "shortleave"],
      default: "fullleave",
    },
    deductions: {
      casualLeaves: { type: Number, default: 0 },
      paidLeaves: { type: Number, default: 0 },
      unPaidLeaves: { type: Number, default: 0 },
    },
  },
  {
    strict: true,
    timestamps: true,
  }
);

// Add compound index for date range queries
AdditionalLeaveSchema.index({ leaveFrom: 1, leaveTo: 1 });

AdditionalLeaveSchema.pre("save", function (next: any) {
  next();
});

const AdditionalLeaves =
  (mongoose.models && mongoose.models.AdditionalLeaves) ||
  mongoose.model("AdditionalLeaves", AdditionalLeaveSchema);

export default AdditionalLeaves;
