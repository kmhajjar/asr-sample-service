
import { DataTypes } from 'sequelize';
import sequelize from '../sequelize.js';
import TranscriptRequest from "./transcript_request.js";


// TODO need indexes and proper assocs
// TODO keep Audio Chunks sorted
const AudioChunk = sequelize.define('AudioChunk', {
    job_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    file_name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    size: { // Don't really need this now, but it's for splitting jobs across workers and concurrently if needed.
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    last_updated_time: {
        type: DataTypes.TIME,
    },
    text: {
        type: DataTypes.TEXT,
        defaultValue: "",
    },
    status: {
        type: DataTypes.ENUM('complete', 'not_started', 'processing', 'retry', 'failed'),
        default_value: 'not_started',
        allowNull: false,
    },
    version: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
    },
});

AudioChunk.belongsTo(TranscriptRequest, { foreignKey: 'job_id' });

export default AudioChunk;