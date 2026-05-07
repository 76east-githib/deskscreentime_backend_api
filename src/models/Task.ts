import mongoose from "mongoose";
const { Schema } = mongoose;

const TaskSchema = new Schema(
  {
    userIds: [{ type: Schema.ObjectId, ref: "User", index: true }],
    companyId: { type: Schema.ObjectId, ref: "User", index: true },
    taskName: { type: String, trim: true, required: true },
    projectId: { type: Schema.ObjectId, ref: "Project", required: true, index: true },
    // for project startTime and endtTime
    startTime: { type: Date },
    endTime: { type: Date },
    sessions: [
      {
        userId: { type: Schema.ObjectId, ref: "User" },
        startTime: { type: Date, required: true },
        endTime: { type: Date, default: null },
        idleTime: { type: Number, default: 0 },
        lastActiveTime: { type: Date },
        status: {
          type: String,
          default: "active",
          enum: ["active", "ended", "crashed"],
        },
        isManual: { type: Boolean, default: false },
        comments: { type: String, trim: true },
        interact: [
          {
            time: { type: String },
            mouseClickCount: { type: Number },
            keypressCount: { type: Number },
          },
        ],
        taskDescription: { type: String, trim: true },
        taskDescriptionStatus: {
          type: String,
          default: "todo",
          enum: ["todo", "pending", "in_progress", "testing", "review", "completed","done"],
          index: true,
        },
      },
    ],
    priority: {
      type: String,
      default: "medium",
      enum: ["low", "medium", "high"],
    },
    taskStatus: {
      type: String,
      default: "todo",
      enum: ["todo", "pending", "in_progress", "testing", "review", "completed","done"],
      index: true,
    },
    hours: { type: Number, default: 0 },
    actualHours: { type: Number, default: 0 },
  },
  {
    strict: true,
    timestamps: true,
  }
);

TaskSchema.pre("save", function (next: any) {
  next();
});

// Force re-registering to avoid cached schema conflicts
delete mongoose.models.Task;
const Task = mongoose.model("Task", TaskSchema);
export default Task;