import mongoose from "mongoose";
const { Schema } = mongoose;

const leaveSchema = new Schema(
  {
    userId: { type: Schema.ObjectId, ref: "Users", index: true },
    date: [
      {
        fromDate: { type: Date, default: null },
        toDate: { type: Date, default: null },
      },
    ],
    dayType: [
      {
        halfDay: { type: Number, default: 0 },
        fullDay: { type: Number, default: 0 },
        shortDay: { type: Number, default: 0 },
        shortDayConverted: { type: Boolean, default: false },
      },
    ],
    // leaveType: { type: String, enum: ["Casual", "Paid"] },
    leaveTypes: [
      {
        casual: { type: Number, default: 0 },
        paid: { type: Number, default: 0 },
        unPaid: { type: Number, default: 0 },
      },
    ],
  },
  {
    strict: true,
    timestamps: true,
  }
);

// Add compound index for date queries
leaveSchema.index({ "date.fromDate": 1, "date.toDate": 1 });

leaveSchema.pre("save", function (next: any) {
  next();
});

const Leave =
  (mongoose.models && mongoose.models.Leave) ||
  mongoose.model("Leave", leaveSchema);

export default Leave;
