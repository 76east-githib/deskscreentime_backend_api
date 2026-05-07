import mongoose from "mongoose";
const { Schema } = mongoose;

var ProjectTaskSchema = new Schema(
  {
    projectId: { type: Schema.ObjectId, required: true,index: true },
    taskName: { type: String, trim: true, required: true },
    taskDescription: { type: String, trim: true },
    priority: {
      type: String,
      default: "medium",
      enum: ["low", "medium", "high"],
    },
    taskStatus: {
      type: String,
      default: "todo",
      enum: ["todo", "pending", "in_progress", "completed"],
      index: true,
    },
    taskUsersIds: [
      {
        value: {
          type: Schema.Types.ObjectId,
          ref: "Users",
          index: true,
        },
        label: {
          type: String,
          trim: true,
        },
      },
    ],
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    sessions: [
      {
        startTime: { type: Date, required: true },
        endTime: { type: Date, default: null },
      },
    ],
    hours: { type: Number, default: 0 },
    actualHours: { type: Number, default: 0 },
    // taskTeamIds
  },
  {
    strict: true,
    timestamps: true,
  }
);

ProjectTaskSchema.pre("save", function (next: any) {
  next();
});

const ProjectTask =
  mongoose.models.ProjectTask ||
  mongoose.model("ProjectTask", ProjectTaskSchema);
export default ProjectTask;
