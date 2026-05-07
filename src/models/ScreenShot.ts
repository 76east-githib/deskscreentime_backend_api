import mongoose from "mongoose";
const { Schema } = mongoose;

var ScreenShotSchema = new Schema(
  {
    userId: { type: Schema.ObjectId, index: true },
    taskId: { type: Schema.ObjectId, index: true },
    companyId: { type: Schema.ObjectId, ref: "Users", index: true },
    imageName: { type: String, trim: true, required: true },
    activeWindow: { type: String },
  },
  {
    strict: true,
    timestamps: true,
  }
);

// Add index on createdAt for time-based queries
ScreenShotSchema.index({ createdAt: 1 });

ScreenShotSchema.pre("save", function (next: any) {
  next();
});

const ScreenShot =
  mongoose.models.ScreenShot || mongoose.model("ScreenShot", ScreenShotSchema);
export default ScreenShot;
