import mongoose from "mongoose";
const { Schema } = mongoose;

const UserSchema = new Schema(
  {
    fullname: { type: String, trim: true },
    companyName: { type: String, trim: true },
    email: {
      type: String,
      trim: true,
      // match: [/\S+@\S+\.\S+/, "Email is invalid"],
      unique: true,
      lowercase: true,
      index: true,
    },
    password: { type: String, trim: true },
    mobile: { type: Number, trim: true },
    // gender: { type: String, default:null, trim: true, lowercase: true },
    role: {
      type: String,
      default: "company",
      enum: ["user", "company", "subCompAdmin", "superAdmin","client"],
      trim: true,
      index: true,
    },
    designation: {
      type: String,
      default: "owner",
      enum: ["developer", "designer", "tester","manager","hr","owner"],
      trim: true,
    },
    address: { type: String, trim: true },
    status: { type: String, default: "active", enum: ["active", "deactive"], index: true },
    otp: { type: Number },
    companyId: {
      type: Schema.ObjectId,
      ref: "Users",
      index: true,
      default: null,
    },
    leaves: [
      {
        year: { type: Number },
        casualLeaves: { type: Number },
        paidLeaves: { type: Number },
        unPaidLeaves: { type: Number },
      },
    ],
    joiningDate: { type: Date, default: null },
    salaryDetails: [
      {
        fromDate: { type: Date, default: null },
        toDate: { type: Date, default: null },
        basic: { type: String, default: "0" },
        hra: { type: String, default: "0" },
        conveyanceAllowance: { type: String, default: "0" },
        mobileAllowance: { type: String, default: "0" },
        specialAllowance: { type: String, default: "0" },
        totalSalary: { type: String, default: "0" },
      },
    ],
    bankDetails: {
      accountNumber: { type: String, trim: true },
      ifscCode: { type: String, trim: true },
      bankName: { type: String, trim: true },
    },
    alternateTracker: {
      type: String,
      default: "UNUSED",
      enum: ["USED", "UNUSED"],
    },
    slipOtp: { type: Number },
  },

  {
    strict: true,
    timestamps: true,
  }
);

UserSchema.pre("save", function (next: any) {
  next();
});
const User =
  (mongoose.models && mongoose.models.User) ||
  mongoose.model("User", UserSchema);
export default User;
