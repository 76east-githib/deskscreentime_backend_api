import mongoose from "mongoose";
const { Schema } = mongoose;

const salarySchema = new Schema(
  {
    userId: { type: Schema.ObjectId, ref: "Users",index: true },
    receivedSalary: {
      salary: { type: String, default: 0 },
      date: { type: Date, default: null, index: true },
      casualLeave: { type: Number, default: 0 },
      paidLeave: { type: Number, default: 0 },
      unpaidLeave: { type: Number, default: 0 },
      security: { type: Number, default: 0 },
      advanceLoan: { type: Number, default: 0 },
      TDS: { type: Number, default: 0 },
      PF: { type: Number, default: 0 },
    },
  },
  {
    strict: true,
    timestamps: true,
  }
);

salarySchema.pre("save", function (next: any) {
  next();
});

const Salary =
  (mongoose.models && mongoose.models.Salary) ||
  mongoose.model("Salary", salarySchema);

export default Salary;