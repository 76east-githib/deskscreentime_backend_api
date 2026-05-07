import mongoose from 'mongoose';
const { Schema } = mongoose;

var ProjectSchema = new Schema({
	userId: { type: Schema.ObjectId ,index: true},
	companyId: { type: Schema.ObjectId, ref: 'Users', index: true },
	projectName: { type: String, trim: true, required: true },
	projectDescription: { type: String, trim: true },
	projectTechnology: { type: String, trim: true },
	projectGitUrl: { type: String, trim: true },
	projectWebsiteUrl: { type: String, trim: true },
	projectStatus: { type: String, enum: ['open', 'completed'], index: true },
	projectTeamIds: [{
		value: {
			type: Schema.Types.ObjectId,
			ref: 'Users',
			index: true
		},
		label: {
			type: String, trim: true
		}
	}],
}, {
	strict: true,
	timestamps: true
})

ProjectSchema.pre('save', function (next: any) {
	next();
})

// ProjectSchema.plugin(mongoosePaginate);
const Project = mongoose.models.Project || mongoose.model('Project', ProjectSchema);
export default Project